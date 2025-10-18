use async_trait::async_trait;
use hmac::{Hmac, Mac};
use rand::distributions::{Distribution, Uniform};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashMap;
use std::fmt;
use std::hash::{Hash, Hasher};
use std::sync::Arc;
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::info;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum DeliveryChannel {
    Email,
    Sms,
}

impl fmt::Display for DeliveryChannel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DeliveryChannel::Email => write!(f, "email"),
            DeliveryChannel::Sms => write!(f, "sms"),
        }
    }
}

#[derive(Clone, Debug)]
pub struct VerificationConfig {
    pub code_length: usize,
    pub ttl: Duration,
    pub resend_interval: Duration,
    pub max_attempts: u32,
}

impl Default for VerificationConfig {
    fn default() -> Self {
        Self {
            code_length: 6,
            ttl: Duration::from_secs(600),
            resend_interval: Duration::from_secs(30),
            max_attempts: 5,
        }
    }
}

#[derive(Debug, Error)]
pub enum VerificationError {
    #[error("verification requests are rate limited; retry in {0:?}")]
    RateLimited(Duration),
    #[error("unable to deliver verification code: {0}")]
    DeliveryFailed(String),
    #[error("verification request not found")]
    NotFound,
    #[error("verification code expired; request a new one")]
    Expired,
    #[error("verification already completed")]
    AlreadyVerified,
    #[error("maximum verification attempts exceeded")]
    MaxAttempts,
    #[error("verification code does not match (remaining attempts: {0})")]
    CodeMismatch(u32),
}

impl VerificationError {
    pub fn status_code(&self) -> axum::http::StatusCode {
        use axum::http::StatusCode;
        match self {
            VerificationError::RateLimited(_) => StatusCode::TOO_MANY_REQUESTS,
            VerificationError::DeliveryFailed(_) => StatusCode::BAD_GATEWAY,
            VerificationError::NotFound => StatusCode::NOT_FOUND,
            VerificationError::Expired => StatusCode::GONE,
            VerificationError::AlreadyVerified => StatusCode::CONFLICT,
            VerificationError::MaxAttempts => StatusCode::TOO_MANY_REQUESTS,
            VerificationError::CodeMismatch(_) => StatusCode::UNAUTHORIZED,
        }
    }
}

#[derive(Debug)]
struct VerificationKey {
    identifier: String,
    channel: DeliveryChannel,
}

impl PartialEq for VerificationKey {
    fn eq(&self, other: &Self) -> bool {
        self.identifier == other.identifier && self.channel == other.channel
    }
}

impl Eq for VerificationKey {}

impl Hash for VerificationKey {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.identifier.hash(state);
        self.channel.hash(state);
    }
}

#[derive(Debug)]
struct VerificationRecord {
    code_hash: Vec<u8>,
    salt: [u8; 16],
    #[allow(dead_code)]
    issued_at: Instant,
    expires_at: Instant,
    attempts: u32,
    used: bool,
    locked: bool,
    last_sent_at: Instant,
    #[allow(dead_code)]
    locale: String,
}

#[derive(Debug, Clone)]
pub struct CodeIssueOutcome {
    pub expires_in: Duration,
    pub retry_after: Duration,
}

#[derive(Debug, Clone)]
pub struct VerifyOutcome {
    pub verified: bool,
    pub remaining_attempts: u32,
}

#[derive(Debug, Error)]
#[error("code delivery failed")]
pub struct CodeSendError;

#[async_trait]
pub trait CodeSender: Send + Sync {
    async fn send_code(
        &self,
        channel: DeliveryChannel,
        identifier: &str,
        code: &str,
        locale: &str,
    ) -> Result<(), CodeSendError>;
}

#[derive(Clone, Default)]
pub struct LoggingCodeSender;

#[async_trait]
impl CodeSender for LoggingCodeSender {
    async fn send_code(
        &self,
        channel: DeliveryChannel,
        identifier: &str,
        _code: &str,
        locale: &str,
    ) -> Result<(), CodeSendError> {
        info!(
            %channel,
            %identifier,
            %locale,
            "dispatching verification code"
        );
        Ok(())
    }
}

#[derive(Clone)]
pub struct VerificationService {
    config: VerificationConfig,
    secret: Arc<[u8]>,
    store: Arc<RwLock<HashMap<VerificationKey, VerificationRecord>>>,
    sender: Arc<dyn CodeSender>,
}

impl VerificationService {
    pub fn new(config: VerificationConfig, secret: Vec<u8>, sender: Arc<dyn CodeSender>) -> Self {
        Self {
            config,
            secret: secret.into(),
            store: Arc::new(RwLock::new(HashMap::new())),
            sender,
        }
    }

    pub async fn issue_code(
        &self,
        identifier: &str,
        channel: DeliveryChannel,
        locale: &str,
    ) -> Result<CodeIssueOutcome, VerificationError> {
        let key = VerificationKey {
            identifier: identifier.to_string(),
            channel,
        };
        let now = Instant::now();

        {
            let store = self.store.read().await;
            if let Some(existing) = store.get(&key) {
                if !existing.used && !existing.locked {
                    if now.duration_since(existing.last_sent_at) < self.config.resend_interval {
                        let retry_after =
                            self.config.resend_interval - now.duration_since(existing.last_sent_at);
                        return Err(VerificationError::RateLimited(retry_after));
                    }
                }
            }
        }

        let code = self.generate_code();
        self.sender
            .send_code(channel, identifier, &code, locale)
            .await
            .map_err(|err| VerificationError::DeliveryFailed(err.to_string()))?;

        let mut salt = [0u8; 16];
        OsRng.fill_bytes(&mut salt);
        let code_hash = self.compute_hash(&salt, &code);
        let record = VerificationRecord {
            code_hash,
            salt,
            issued_at: now,
            expires_at: now + self.config.ttl,
            attempts: 0,
            used: false,
            locked: false,
            last_sent_at: now,
            locale: locale.to_string(),
        };

        {
            let mut store = self.store.write().await;
            store.insert(key, record);
        }

        Ok(CodeIssueOutcome {
            expires_in: self.config.ttl,
            retry_after: self.config.resend_interval,
        })
    }

    pub async fn verify_code(
        &self,
        identifier: &str,
        channel: DeliveryChannel,
        code: &str,
    ) -> Result<VerifyOutcome, VerificationError> {
        let key = VerificationKey {
            identifier: identifier.to_string(),
            channel,
        };

        let mut store = self.store.write().await;
        let record = store.get_mut(&key).ok_or(VerificationError::NotFound)?;

        let now = Instant::now();
        if now >= record.expires_at {
            store.remove(&key);
            return Err(VerificationError::Expired);
        }
        if record.used {
            return Err(VerificationError::AlreadyVerified);
        }
        if record.locked {
            return Err(VerificationError::MaxAttempts);
        }

        record.attempts += 1;
        let expected = self.compute_hash(&record.salt, code);
        if expected == record.code_hash {
            record.used = true;
            Ok(VerifyOutcome {
                verified: true,
                remaining_attempts: self.config.max_attempts.saturating_sub(record.attempts),
            })
        } else {
            if record.attempts >= self.config.max_attempts {
                record.locked = true;
                Err(VerificationError::MaxAttempts)
            } else {
                let remaining = self.config.max_attempts.saturating_sub(record.attempts);
                Err(VerificationError::CodeMismatch(remaining))
            }
        }
    }

    fn generate_code(&self) -> String {
        let mut rng = rand::thread_rng();
        let dist = Uniform::new_inclusive(0u8, 9);
        (0..self.config.code_length)
            .map(|_| char::from(b'0' + dist.sample(&mut rng)))
            .collect()
    }

    fn compute_hash(&self, salt: &[u8; 16], code: &str) -> Vec<u8> {
        let mut mac =
            HmacSha256::new_from_slice(&self.secret).expect("HMAC can take key of any size");
        mac.update(salt);
        mac.update(code.as_bytes());
        mac.finalize().into_bytes().to_vec()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[derive(Default)]
    struct TestSender {
        last_code: Mutex<Option<String>>,
    }

    #[async_trait]
    impl CodeSender for TestSender {
        async fn send_code(
            &self,
            _channel: DeliveryChannel,
            _identifier: &str,
            code: &str,
            _locale: &str,
        ) -> Result<(), CodeSendError> {
            *self.last_code.lock().unwrap() = Some(code.to_string());
            Ok(())
        }
    }

    #[tokio::test]
    async fn issue_and_verify_code() {
        let sender = Arc::new(TestSender::default());
        let service = VerificationService::new(
            VerificationConfig::default(),
            b"secret".to_vec(),
            sender.clone(),
        );

        service
            .issue_code("user@example.com", DeliveryChannel::Email, "en-US")
            .await
            .expect("issue code");
        let code = sender
            .last_code
            .lock()
            .unwrap()
            .clone()
            .expect("captured code");

        let result = service
            .verify_code("user@example.com", DeliveryChannel::Email, &code)
            .await
            .expect("verify code");
        assert!(result.verified);
        assert!(result.remaining_attempts < VerificationConfig::default().max_attempts);
    }

    #[tokio::test]
    async fn rate_limit_is_enforced() {
        let sender = Arc::new(TestSender::default());
        let config = VerificationConfig {
            resend_interval: Duration::from_secs(60),
            ..Default::default()
        };
        let service = VerificationService::new(config.clone(), b"secret".to_vec(), sender);

        service
            .issue_code("123", DeliveryChannel::Sms, "en-US")
            .await
            .expect("first code");
        let err = service
            .issue_code("123", DeliveryChannel::Sms, "en-US")
            .await
            .expect_err("rate limited");

        match err {
            VerificationError::RateLimited(duration) => {
                assert!(duration <= config.resend_interval);
            }
            other => panic!("unexpected error: {:?}", other),
        }
    }

    #[tokio::test]
    async fn mismatched_code_counts_attempts() {
        let sender = Arc::new(TestSender::default());
        let config = VerificationConfig {
            max_attempts: 2,
            ..Default::default()
        };
        let service = VerificationService::new(config, b"secret".to_vec(), sender);

        service
            .issue_code("user", DeliveryChannel::Email, "en-US")
            .await
            .expect("code issued");

        let err = service
            .verify_code("user", DeliveryChannel::Email, "000000")
            .await
            .expect_err("mismatch");
        matches!(err, VerificationError::CodeMismatch(_));

        let err = service
            .verify_code("user", DeliveryChannel::Email, "000000")
            .await
            .expect_err("max attempts");
        matches!(err, VerificationError::MaxAttempts);
    }
}
