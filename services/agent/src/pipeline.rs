use crate::error::AgentError;
use crate::jobs::{EvaluateJob, JobExecutor};
use crate::publisher::{ActionOutcome, ActionResultPublisher};
use async_nats::Client as NatsClient;
use futures::StreamExt;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;
use tracing::{debug, error, info, warn};

#[derive(Clone)]
pub struct ActionPipeline<P: ActionResultPublisher> {
    client: NatsClient,
    processor: ActionProcessor<P>,
}

impl<P: ActionResultPublisher> ActionPipeline<P> {
    pub fn new(client: NatsClient, executor: JobExecutor, publisher: Arc<P>) -> Self {
        let processor = ActionProcessor::new(executor, publisher);
        Self { client, processor }
    }

    pub async fn run(&self) -> Result<(), AgentError> {
        let mut sub = self.client.subscribe("eco.action.*").await?;
        info!("action pipeline subscribed to eco.action.*");
        while let Some(msg) = sub.next().await {
            if let Err(err) = self.process_message(&msg.subject, &msg.payload).await {
                error!(%msg.subject, ?err, "failed to process action message");
            }
        }
        Ok(())
    }

    pub async fn process_message(&self, subject: &str, payload: &[u8]) -> Result<(), AgentError> {
        match subject.strip_prefix("eco.action.") {
            Some("cast") => {
                let event: ActionEvent = serde_json::from_slice(payload)?;
                self.processor.handle_action_event(event).await?;
            }
            Some("evaluate") => {
                let event: EvaluateEvent = serde_json::from_slice(payload)?;
                self.processor.handle_evaluate_event(event).await?;
            }
            Some(other) => {
                warn!(%other, "unsupported action subject");
            }
            None => {
                warn!(%subject, "unexpected subject" );
            }
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct ActionEvent {
    pub id: String,
    pub kind: String,
    pub payload: Value,
    #[serde(default)]
    pub requested_by: Option<String>,
}

impl ActionEvent {
    pub fn into_command(self) -> Result<Option<ActionCommand>, AgentError> {
        let requested_by = self.requested_by.unwrap_or_else(|| "nats".to_string());
        match self.kind.as_str() {
            "qpp.evaluate" => {
                let payload: EvaluatePayload = serde_json::from_value(self.payload)?;
                Ok(Some(ActionCommand::Evaluate(EvaluateJob {
                    id: self.id,
                    expression: payload.expression,
                    requested_by,
                    model: payload.model,
                })))
            }
            other => {
                warn!(%other, "unsupported action kind");
                Ok(None)
            }
        }
    }
}

#[derive(Debug, Deserialize)]
struct EvaluatePayload {
    expression: String,
    #[serde(default)]
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EvaluateEvent {
    id: String,
    expression: String,
    #[serde(default)]
    requested_by: Option<String>,
    #[serde(default)]
    model: Option<String>,
}

#[derive(Clone, Debug)]
pub enum ActionCommand {
    Evaluate(EvaluateJob),
}

#[derive(Clone)]
pub struct ActionProcessor<P: ActionResultPublisher> {
    executor: JobExecutor,
    publisher: Arc<P>,
}

impl<P: ActionResultPublisher> ActionProcessor<P> {
    pub fn new(executor: JobExecutor, publisher: Arc<P>) -> Self {
        Self {
            executor,
            publisher,
        }
    }

    pub async fn handle_action_event(&self, event: ActionEvent) -> Result<(), AgentError> {
        if let Some(command) = event.into_command()? {
            let outcome = self.execute(command).await;
            self.publish(outcome).await?;
        }
        Ok(())
    }

    async fn handle_evaluate_event(&self, event: EvaluateEvent) -> Result<(), AgentError> {
        let job = EvaluateJob {
            id: event.id,
            expression: event.expression,
            requested_by: event.requested_by.unwrap_or_else(|| "nats".to_string()),
            model: event.model,
        };
        let outcome = self.execute(ActionCommand::Evaluate(job)).await;
        self.publish(outcome).await?;
        Ok(())
    }

    async fn execute(&self, command: ActionCommand) -> ActionOutcome {
        match command {
            ActionCommand::Evaluate(job) => match self.executor.evaluate(job.clone()).await {
                Ok(result) => ActionOutcome::success(job, result),
                Err(err) => {
                    warn!(?err, "evaluation failed");
                    ActionOutcome::failure(
                        job.id,
                        job.requested_by,
                        format!("evaluation failed: {err}"),
                    )
                }
            },
        }
    }

    async fn publish(&self, outcome: ActionOutcome) -> Result<(), AgentError> {
        debug!(id = %outcome.id, accepted = outcome.accepted, "publishing outcome");
        self.publisher.publish(&outcome).await
    }
}
