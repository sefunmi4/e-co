use crate::error::AgentError;
use crate::frequency::{FrequencyHub, FrequencySample};
use crate::jobs::{job_from_gesture, EvaluateJob, JobExecutor};
use crate::pipeline::{ActionCommand, ActionEvent};
use crate::proto::actions::{
    eco_actions_server::EcoActions, Action, ActionAck, EvaluateRequest, EvaluateResponse,
    FrequencyStreamRequest, FrequencyUpdate, GestureEvaluation,
};
use crate::proto::symbolcast::PointerEvent;
use crate::publisher::{ActionOutcome, ActionResultPublisher};
use crate::symbolcast::SymbolCastInvoker;
use async_stream::try_stream;
use futures::Stream;
use std::pin::Pin;
use std::sync::Arc;
use tokio::sync::broadcast;
use tonic::{Request, Response, Status};
use tracing::{debug, info};

pub struct ActionGrpcService<P, S>
where
    P: ActionResultPublisher,
    S: SymbolCastInvoker,
{
    executor: JobExecutor,
    publisher: Arc<P>,
    frequency: FrequencyHub,
    symbolcast: Arc<S>,
}

impl<P, S> ActionGrpcService<P, S>
where
    P: ActionResultPublisher,
    S: SymbolCastInvoker,
{
    pub fn new(
        executor: JobExecutor,
        publisher: Arc<P>,
        frequency: FrequencyHub,
        symbolcast: Arc<S>,
    ) -> Self {
        Self {
            executor,
            publisher,
            frequency,
            symbolcast,
        }
    }

    async fn run_evaluation(&self, job: EvaluateJob) -> Result<ActionOutcome, AgentError> {
        match self.executor.evaluate(job.clone()).await {
            Ok(result) => Ok(ActionOutcome::success(job, result)),
            Err(err) => Ok(ActionOutcome::failure(
                job.id,
                job.requested_by,
                format!("evaluation failed: {err}"),
            )),
        }
    }

    async fn publish_outcome(&self, outcome: ActionOutcome) -> Result<ActionOutcome, AgentError> {
        self.publisher.publish(&outcome).await?;
        Ok(outcome)
    }
}

#[tonic::async_trait]
impl<P, S> EcoActions for ActionGrpcService<P, S>
where
    P: ActionResultPublisher,
    S: SymbolCastInvoker,
{
    async fn cast(&self, request: Request<Action>) -> Result<Response<ActionAck>, Status> {
        let action = request.into_inner();
        let payload = if action.payload.is_empty() {
            serde_json::Value::Null
        } else {
            serde_json::from_str(&action.payload)
                .map_err(|err| Status::invalid_argument(err.to_string()))?
        };
        let event = ActionEvent {
            id: action.id,
            kind: action.kind,
            payload,
            requested_by: Some(action.requested_by),
        };
        match event
            .into_command()
            .map_err(|err| Status::invalid_argument(err.to_string()))?
        {
            Some(command) => {
                let outcome = self.run_evaluation_from_command(command).await?;
                Ok(Response::new(outcome.ack()))
            }
            None => Err(Status::invalid_argument("unsupported action")),
        }
    }

    async fn evaluate(
        &self,
        request: Request<EvaluateRequest>,
    ) -> Result<Response<EvaluateResponse>, Status> {
        let req = request.into_inner();
        let id = if req.job_id.is_empty() {
            uuid::Uuid::new_v4().to_string()
        } else {
            req.job_id
        };
        let job = EvaluateJob {
            id,
            expression: req.expression,
            requested_by: if req.requested_by.is_empty() {
                "grpc".to_string()
            } else {
                req.requested_by
            },
            model: if req.model.is_empty() {
                None
            } else {
                Some(req.model)
            },
        };
        let outcome = self
            .run_evaluation(job)
            .await
            .map_err(|err| Status::internal(err.to_string()))?;
        let outcome = self
            .publish_outcome(outcome)
            .await
            .map_err(|err| Status::internal(err.to_string()))?;
        let response = outcome
            .evaluate_response()
            .ok_or_else(|| Status::internal("evaluation failed"))?;
        Ok(Response::new(response))
    }

    type StreamFrequenciesStream =
        Pin<Box<dyn Stream<Item = Result<FrequencyUpdate, Status>> + Send>>;

    async fn stream_frequencies(
        &self,
        request: Request<FrequencyStreamRequest>,
    ) -> Result<Response<Self::StreamFrequenciesStream>, Status> {
        let job_id = request.into_inner().job_id;
        let mut receiver = self.frequency.subscribe();
        let frequency = self.frequency.clone();

        let initial = frequency.latest(&job_id).await;
        let stream = try_stream! {
            if let Some(sample) = initial {
                yield to_update(sample);
            }
            loop {
                match receiver.recv().await {
                    Ok(sample) if sample.job_id == job_id => {
                        yield to_update(sample);
                    }
                    Ok(_) => continue,
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        };

        Ok(Response::new(
            Box::pin(stream) as Self::StreamFrequenciesStream
        ))
    }

    async fn recognize_gesture(
        &self,
        request: Request<tonic::Streaming<PointerEvent>>,
    ) -> Result<Response<GestureEvaluation>, Status> {
        let mut stream = request.into_inner();
        let mut events = Vec::new();
        while let Some(event) = stream.message().await? {
            debug!(x = event.x, y = event.y, "received pointer event");
            events.push(event);
        }
        let gesture = self
            .symbolcast
            .recognize(events)
            .await
            .map_err(|err| Status::internal(err.to_string()))?;
        let job = job_from_gesture(&gesture)
            .ok_or_else(|| Status::failed_precondition("gesture not mapped"))?;
        info!(gesture_id = %gesture.id, "gesture recognized, running job");
        let outcome = self
            .run_evaluation(job)
            .await
            .map_err(|err| Status::internal(err.to_string()))?;
        let outcome = self
            .publish_outcome(outcome)
            .await
            .map_err(|err| Status::internal(err.to_string()))?;
        let result = outcome
            .evaluate_response()
            .ok_or_else(|| Status::internal("evaluation failed"))?;
        let response = GestureEvaluation {
            job_id: result.job_id.clone(),
            gesture_id: gesture.id,
            gesture_label: gesture.label,
            confidence: gesture.confidence as f64,
            result: Some(result),
        };
        Ok(Response::new(response))
    }
}

impl<P, S> ActionGrpcService<P, S>
where
    P: ActionResultPublisher,
    S: SymbolCastInvoker,
{
    pub(crate) async fn run_evaluation_from_command(
        &self,
        command: ActionCommand,
    ) -> Result<ActionOutcome, Status> {
        match command {
            ActionCommand::Evaluate(job) => {
                let evaluated = self
                    .run_evaluation(job)
                    .await
                    .map_err(|err| Status::internal(err.to_string()))?;
                let published = self
                    .publish_outcome(evaluated)
                    .await
                    .map_err(|err| Status::internal(err.to_string()))?;
                Ok(published)
            }
        }
    }
}

fn to_update(sample: FrequencySample) -> FrequencyUpdate {
    FrequencyUpdate {
        job_id: sample.job_id,
        frequency: sample.frequency,
        amplitude: sample.amplitude,
        timestamp_ms: sample.timestamp_ms,
    }
}
