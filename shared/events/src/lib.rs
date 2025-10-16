use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventOrigin {
    Client,
    Server,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodEntered {
    pub pod_id: Uuid,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<Uuid>,
    pub occurred_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub referrer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<EventOrigin>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactViewed {
    pub artifact_id: Uuid,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pod_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub surface: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_id: Option<Uuid>,
    pub occurred_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<EventOrigin>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckoutStarted {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cart_total_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_count: Option<u32>,
    pub occurred_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<EventOrigin>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleRecorded {
    pub order_id: Uuid,
    pub user_id: Uuid,
    pub total_cents: i64,
    pub occurred_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<EventOrigin>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AnalyticsEvent {
    PodEntered(PodEntered),
    ArtifactViewed(ArtifactViewed),
    CheckoutStarted(CheckoutStarted),
    SaleRecorded(SaleRecorded),
}

impl AnalyticsEvent {
    pub fn event_type(&self) -> &'static str {
        match self {
            AnalyticsEvent::PodEntered(_) => "pod_entered",
            AnalyticsEvent::ArtifactViewed(_) => "artifact_viewed",
            AnalyticsEvent::CheckoutStarted(_) => "checkout_started",
            AnalyticsEvent::SaleRecorded(_) => "sale_recorded",
        }
    }

    pub fn occurred_at(&self) -> DateTime<Utc> {
        match self {
            AnalyticsEvent::PodEntered(event) => event.occurred_at,
            AnalyticsEvent::ArtifactViewed(event) => event.occurred_at,
            AnalyticsEvent::CheckoutStarted(event) => event.occurred_at,
            AnalyticsEvent::SaleRecorded(event) => event.occurred_at,
        }
    }
}
