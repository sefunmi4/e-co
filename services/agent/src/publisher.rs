use crate::error::AgentError;
use crate::jobs::{EvaluateJob, EvaluationResult};
use crate::proto::actions::{ActionAck, EvaluateResponse};
use async_trait::async_trait;
use serde::Serialize;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::debug;

#[derive(Clone, Serialize, Debug)]
pub struct ActionOutcome {
    pub id: String,
    pub requested_by: String,
    pub accepted: bool,
    pub message: String,
    pub model: String,
    pub energy: Option<f64>,
    pub fidelity: Option<f64>,
    pub timestamp_ms: i64,
}

impl ActionOutcome {
    pub fn success(job: EvaluateJob, result: EvaluationResult) -> Self {
        Self {
            id: job.id,
            requested_by: job.requested_by,
            accepted: true,
            message: "evaluation completed".to_string(),
            model: result.model,
            energy: Some(result.energy),
            fidelity: Some(result.fidelity),
            timestamp_ms: current_timestamp(),
        }
    }

    pub fn failure(id: String, requested_by: String, message: String) -> Self {
        Self {
            id,
            requested_by,
            accepted: false,
            message,
            model: "cpp-qpp".to_string(),
            energy: None,
            fidelity: None,
            timestamp_ms: current_timestamp(),
        }
    }

    pub fn ack(&self) -> ActionAck {
        ActionAck {
            id: self.id.clone(),
            accepted: self.accepted,
            message: self.message.clone(),
        }
    }

    pub fn evaluate_response(&self) -> Option<EvaluateResponse> {
        if self.accepted {
            Some(EvaluateResponse {
                job_id: self.id.clone(),
                energy: self.energy.unwrap_or_default(),
                fidelity: self.fidelity.unwrap_or_default(),
                model: self.model.clone(),
            })
        } else {
            None
        }
    }
}

fn current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

#[async_trait]
pub trait ActionResultPublisher: Send + Sync + 'static {
    async fn publish(&self, outcome: &ActionOutcome) -> Result<(), AgentError>;
}

#[derive(Clone)]
pub struct NatsPublisher {
    client: async_nats::Client,
}

impl NatsPublisher {
    pub fn new(client: async_nats::Client) -> Self {
        Self { client }
    }
}

#[async_trait]
impl ActionResultPublisher for NatsPublisher {
    async fn publish(&self, outcome: &ActionOutcome) -> Result<(), AgentError> {
        let subject = format!("eco.action.result.{}", outcome.id);
        let payload = serde_json::to_vec(outcome)?;
        self.client.publish(subject, payload.into()).await?;
        Ok(())
    }
}

#[derive(Clone, Default)]
pub struct MockPublisher {
    pub results: Arc<tokio::sync::Mutex<Vec<ActionOutcome>>>,
}

#[async_trait]
impl ActionResultPublisher for MockPublisher {
    async fn publish(&self, outcome: &ActionOutcome) -> Result<(), AgentError> {
        debug!(id = %outcome.id, accepted = outcome.accepted, "mock publish");
        let mut guard = self.results.lock().await;
        guard.push(outcome.clone());
        Ok(())
    }
}
