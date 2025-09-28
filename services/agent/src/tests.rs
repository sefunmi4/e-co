use super::frequency::FrequencyHub;
use super::grpc_service::ActionGrpcService;
use super::jobs::{job_from_gesture, JobExecutor};
use super::pipeline::{ActionCommand, ActionEvent, ActionProcessor};
use super::proto::symbolcast::Gesture;
use super::publisher::MockPublisher;
use super::symbolcast::MockSymbolCastInvoker;
use serde_json::json;
use std::sync::Arc;

#[tokio::test]
async fn pipeline_publishes_results_for_cast_events() {
    let frequency = FrequencyHub::new(8);
    let executor = JobExecutor::new(frequency.clone());
    let publisher = Arc::new(MockPublisher::default());
    let processor = ActionProcessor::new(executor, publisher.clone());

    let event = ActionEvent {
        id: "job-1".to_string(),
        kind: "qpp.evaluate".to_string(),
        payload: json!({ "expression": "H(q0)" }),
        requested_by: Some("tester".to_string()),
    };

    processor
        .handle_action_event(event)
        .await
        .expect("process event");

    let results = publisher.results.lock().await;
    assert_eq!(results.len(), 1, "one result published");
    assert!(results[0].accepted, "result accepted");
    assert!(
        results[0].energy.unwrap_or_default() > 0.0,
        "energy computed"
    );
}

#[tokio::test]
async fn gesture_recognition_triggers_evaluation() {
    let frequency = FrequencyHub::new(8);
    let executor = JobExecutor::new(frequency.clone());
    let publisher = Arc::new(MockPublisher::default());
    let symbolcast = MockSymbolCastInvoker::default();
    {
        let mut guard = symbolcast.gesture.lock().await;
        *guard = Some(Gesture {
            id: "triangle".to_string(),
            label: "Triangle".to_string(),
            confidence: 0.94,
        });
    }
    let service = ActionGrpcService::new(
        executor,
        publisher.clone(),
        frequency.clone(),
        Arc::new(symbolcast),
    );

    let job = job_from_gesture(&Gesture {
        id: "triangle".to_string(),
        label: "Triangle".to_string(),
        confidence: 0.94,
    })
    .expect("gesture job");

    let outcome = service
        .run_evaluation_from_command(ActionCommand::Evaluate(job.clone()))
        .await
        .expect("evaluation");

    assert!(outcome.accepted);
    assert!(outcome.energy.unwrap_or_default() > 0.0);

    let latest = frequency.latest(&job.id).await.expect("frequency sample");
    assert_eq!(latest.job_id, job.id);

    let published = publisher.results.lock().await;
    assert_eq!(published.len(), 1, "published outcome for gesture job");
    assert!(published[0].accepted);
}
