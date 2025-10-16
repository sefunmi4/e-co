use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const EVENT_POD_ENTERED: &str = "pod_entered";
pub const EVENT_ARTIFACT_VIEWED: &str = "artifact_viewed";
pub const EVENT_CHECKOUT_STARTED: &str = "checkout_started";
pub const EVENT_SALE_COMPLETED: &str = "sale_completed";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AnalyticsEvent {
    PodEntered(PodEnteredEvent),
    ArtifactViewed(ArtifactViewedEvent),
    CheckoutStarted(CheckoutStartedEvent),
    SaleCompleted(SaleCompletedEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodEnteredEvent {
    pub pod_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactViewedEvent {
    pub artifact_id: Uuid,
    #[serde(default)]
    pub pod_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckoutStartedEvent {
    #[serde(default)]
    pub pod_id: Option<Uuid>,
    pub artifact_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleCompletedEvent {
    pub order_id: Uuid,
    pub artifact_id: Uuid,
    #[serde(default)]
    pub pod_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsEventEnvelope {
    #[serde(flatten)]
    pub event: AnalyticsEvent,
    #[serde(default)]
    pub occurred_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct AnalyticsEventRecord {
    pub event_type: &'static str,
    pub occurred_at: DateTime<Utc>,
    pub pod_id: Option<Uuid>,
    pub artifact_id: Option<Uuid>,
}

impl AnalyticsEventEnvelope {
    pub fn into_records(self) -> Vec<AnalyticsEventRecord> {
        let timestamp = self.occurred_at.unwrap_or_else(Utc::now);
        self.event.into_records_at(timestamp)
    }

    pub fn records(&self) -> Vec<AnalyticsEventRecord> {
        let timestamp = self.occurred_at.unwrap_or_else(Utc::now);
        self.event.to_records_at(timestamp)
    }
}

impl AnalyticsEvent {
    pub fn event_type(&self) -> &'static str {
        match self {
            AnalyticsEvent::PodEntered(_) => EVENT_POD_ENTERED,
            AnalyticsEvent::ArtifactViewed(_) => EVENT_ARTIFACT_VIEWED,
            AnalyticsEvent::CheckoutStarted(_) => EVENT_CHECKOUT_STARTED,
            AnalyticsEvent::SaleCompleted(_) => EVENT_SALE_COMPLETED,
        }
    }

    pub fn to_records_at(&self, occurred_at: DateTime<Utc>) -> Vec<AnalyticsEventRecord> {
        match self {
            AnalyticsEvent::PodEntered(event) => vec![AnalyticsEventRecord {
                event_type: EVENT_POD_ENTERED,
                occurred_at,
                pod_id: Some(event.pod_id),
                artifact_id: None,
            }],
            AnalyticsEvent::ArtifactViewed(event) => vec![AnalyticsEventRecord {
                event_type: EVENT_ARTIFACT_VIEWED,
                occurred_at,
                pod_id: event.pod_id,
                artifact_id: Some(event.artifact_id),
            }],
            AnalyticsEvent::CheckoutStarted(event) => event
                .artifact_ids
                .iter()
                .cloned()
                .map(|artifact_id| AnalyticsEventRecord {
                    event_type: EVENT_CHECKOUT_STARTED,
                    occurred_at,
                    pod_id: event.pod_id,
                    artifact_id: Some(artifact_id),
                })
                .collect(),
            AnalyticsEvent::SaleCompleted(event) => vec![AnalyticsEventRecord {
                event_type: EVENT_SALE_COMPLETED,
                occurred_at,
                pod_id: event.pod_id,
                artifact_id: Some(event.artifact_id),
            }],
        }
    }

    pub fn into_records_at(self, occurred_at: DateTime<Utc>) -> Vec<AnalyticsEventRecord> {
        match self {
            AnalyticsEvent::PodEntered(event) => vec![AnalyticsEventRecord {
                event_type: EVENT_POD_ENTERED,
                occurred_at,
                pod_id: Some(event.pod_id),
                artifact_id: None,
            }],
            AnalyticsEvent::ArtifactViewed(event) => vec![AnalyticsEventRecord {
                event_type: EVENT_ARTIFACT_VIEWED,
                occurred_at,
                pod_id: event.pod_id,
                artifact_id: Some(event.artifact_id),
            }],
            AnalyticsEvent::CheckoutStarted(event) => event
                .artifact_ids
                .into_iter()
                .map(|artifact_id| AnalyticsEventRecord {
                    event_type: EVENT_CHECKOUT_STARTED,
                    occurred_at,
                    pod_id: event.pod_id,
                    artifact_id: Some(artifact_id),
                })
                .collect(),
            AnalyticsEvent::SaleCompleted(event) => vec![AnalyticsEventRecord {
                event_type: EVENT_SALE_COMPLETED,
                occurred_at,
                pod_id: event.pod_id,
                artifact_id: Some(event.artifact_id),
            }],
        }
    }
}
