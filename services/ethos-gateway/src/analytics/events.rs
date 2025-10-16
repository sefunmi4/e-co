use anyhow::Context;
use chrono::Utc;
use deadpool_postgres::{GenericClient, Pool};
use events::{
    AnalyticsEvent, AnalyticsEventEnvelope, AnalyticsEventRecord, CheckoutStartedEvent,
    SaleCompletedEvent, EVENT_SALE_COMPLETED,
};
use uuid::Uuid;

use crate::services::orders::OrderDetail;

const INSERT_EVENT_SQL: &str =
    "INSERT INTO analytics_events (id, event_type, pod_id, artifact_id, occurred_at) VALUES ($1, $2, $3, $4, $5)";

pub async fn persist_event_records<C: GenericClient>(
    client: &C,
    records: &[AnalyticsEventRecord],
) -> anyhow::Result<()> {
    for record in records {
        client
            .execute(
                INSERT_EVENT_SQL,
                &[
                    &Uuid::new_v4(),
                    &record.event_type,
                    &record.pod_id,
                    &record.artifact_id,
                    &record.occurred_at,
                ],
            )
            .await?;
    }
    Ok(())
}

pub async fn persist_envelopes(
    pool: &Pool,
    envelopes: &[AnalyticsEventEnvelope],
) -> anyhow::Result<()> {
    if envelopes.is_empty() {
        return Ok(());
    }
    let client = pool
        .get()
        .await
        .context("acquire connection for persist_envelopes")?;
    let mut total = Vec::new();
    for envelope in envelopes {
        total.extend(envelope.records());
    }
    persist_event_records(&client, &total).await
}

pub async fn record_sale_events<C: GenericClient>(
    client: &C,
    order: &OrderDetail,
) -> anyhow::Result<()> {
    let mut records = Vec::new();
    for item in &order.items {
        records.push(AnalyticsEventRecord {
            event_type: EVENT_SALE_COMPLETED,
            occurred_at: Utc::now(),
            pod_id: None,
            artifact_id: Some(item.artifact_id),
        });
    }
    persist_event_records(client, &records).await
}

pub fn build_checkout_started_event(
    pod_id: Option<Uuid>,
    artifact_ids: Vec<Uuid>,
) -> AnalyticsEvent {
    AnalyticsEvent::CheckoutStarted(CheckoutStartedEvent {
        pod_id,
        artifact_ids,
    })
}

pub fn build_sale_completed_event(
    order_id: Uuid,
    artifact_id: Uuid,
    pod_id: Option<Uuid>,
) -> AnalyticsEvent {
    AnalyticsEvent::SaleCompleted(SaleCompletedEvent {
        order_id,
        artifact_id,
        pod_id,
    })
}
