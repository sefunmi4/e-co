use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{broadcast, RwLock};

#[derive(Clone, Debug)]
pub struct FrequencySample {
    pub job_id: String,
    pub frequency: f64,
    pub amplitude: f64,
    pub timestamp_ms: i64,
}

#[derive(Clone)]
pub struct FrequencyHub {
    sender: broadcast::Sender<FrequencySample>,
    state: Arc<RwLock<HashMap<String, FrequencySample>>>,
}

impl FrequencyHub {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self {
            sender,
            state: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<FrequencySample> {
        self.sender.subscribe()
    }

    pub async fn publish(&self, mut sample: FrequencySample) {
        if sample.timestamp_ms == 0 {
            sample.timestamp_ms = current_timestamp();
        }
        {
            let mut guard = self.state.write().await;
            guard.insert(sample.job_id.clone(), sample.clone());
        }
        let _ = self.sender.send(sample);
    }

    pub async fn latest(&self, job_id: &str) -> Option<FrequencySample> {
        let guard = self.state.read().await;
        guard.get(job_id).cloned()
    }
}

fn current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}
