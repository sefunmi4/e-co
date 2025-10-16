use std::sync::Arc;

use anyhow::Context;
use async_trait::async_trait;
use deadpool_postgres::Pool;
use serde_json::to_value;
use tokio_postgres::types::Json;
use uuid::Uuid;

pub use events::{
    AnalyticsEvent, ArtifactViewed, CheckoutStarted, EventOrigin, PodEntered, SaleRecorded,
};

#[async_trait]
pub trait AnalyticsSink: Send + Sync {
    async fn record(&self, event: AnalyticsEvent) -> anyhow::Result<()>;
}

#[derive(Clone)]
pub struct PostgresAnalyticsSink {
    pool: Pool,
}

impl PostgresAnalyticsSink {
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AnalyticsSink for PostgresAnalyticsSink {
    async fn record(&self, event: AnalyticsEvent) -> anyhow::Result<()> {
        let client = self
            .pool
            .get()
            .await
            .context("acquire connection for analytics event")?;
        let payload = to_value(&event)?;
        let event_type = event.event_type();
        let occurred_at = event.occurred_at();
        client
            .execute(
                "INSERT INTO analytics_events (id, event_type, occurred_at, payload) VALUES ($1, $2, $3, $4)",
                &[&Uuid::new_v4(), &event_type, &occurred_at, &Json(payload)],
            )
            .await
            .context("insert analytics event")?;
        Ok(())
    }
}

pub type DynAnalyticsSink = Arc<dyn AnalyticsSink>;
