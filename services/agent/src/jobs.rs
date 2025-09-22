use crate::error::AgentError;
use crate::frequency::{FrequencyHub, FrequencySample};
use crate::proto::symbolcast::Gesture;
use crate::qpp_bridge;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone)]
pub struct JobExecutor {
    engine: Arc<Mutex<()>>,
    frequency: FrequencyHub,
}

#[derive(Clone, Debug)]
pub struct EvaluateJob {
    pub id: String,
    pub expression: String,
    pub requested_by: String,
    pub model: Option<String>,
}

#[derive(Clone, Debug)]
pub struct EvaluationResult {
    pub energy: f64,
    pub fidelity: f64,
    pub model: String,
}

impl JobExecutor {
    pub fn new(frequency: FrequencyHub) -> Self {
        Self {
            engine: Arc::new(Mutex::new(())),
            frequency,
        }
    }

    pub async fn evaluate(&self, job: EvaluateJob) -> Result<EvaluationResult, AgentError> {
        let _guard = self.engine.lock().await;
        let raw = qpp_bridge::evaluate_expression(&job.expression)?;
        let model = job.model.clone().unwrap_or_else(|| "cpp-qpp".to_string());
        let result = EvaluationResult {
            energy: raw.energy,
            fidelity: raw.fidelity,
            model: model.clone(),
        };

        let sample = FrequencySample {
            job_id: job.id.clone(),
            frequency: derive_frequency(raw.energy, raw.fidelity),
            amplitude: raw.fidelity,
            timestamp_ms: 0,
        };
        self.frequency.publish(sample).await;

        Ok(result)
    }
}

pub fn derive_frequency(energy: f64, fidelity: f64) -> f64 {
    let base = (energy / 100.0).clamp(0.0, 1.0);
    let coherence = (fidelity / 2.0).clamp(0.0, 0.5);
    0.05 + base + coherence
}

pub fn job_from_gesture(gesture: &Gesture) -> Option<EvaluateJob> {
    let expression = match gesture.id.as_str() {
        "triangle" => "H(q0)".to_string(),
        "circle" => "X(q0)".to_string(),
        "square" => "Z(q0)".to_string(),
        other => {
            if other.is_empty() {
                return None;
            }
            format!("RX(0.5, {other})")
        }
    };

    Some(EvaluateJob {
        id: format!("gesture-{}", Uuid::new_v4()),
        expression,
        requested_by: "symbolcastd".to_string(),
        model: None,
    })
}
