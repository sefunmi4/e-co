use anyhow::Context;
use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::Serialize;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::analytics::TimeWindow;

#[derive(Debug, Clone, Serialize)]
pub struct EventBucket {
    pub bucket_start: DateTime<Utc>,
    pub bucket_end: DateTime<Utc>,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PodEventBucket {
    pub pod_id: Uuid,
    #[serde(flatten)]
    pub bucket: EventBucket,
}

#[derive(Debug, Clone, Serialize)]
pub struct ArtifactEventBucket {
    pub artifact_id: Uuid,
    #[serde(flatten)]
    pub bucket: EventBucket,
}

#[derive(Debug, Clone, Serialize)]
pub struct Paginated<T> {
    pub items: Vec<T>,
    pub has_more: bool,
}

pub async fn aggregate_pod_events(
    pool: &Pool,
    window: TimeWindow,
    page: i64,
    page_size: i64,
) -> anyhow::Result<Paginated<PodEventBucket>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for aggregate_pod_events")?;
    let limit = page_size + 1;
    let offset = (page - 1) * page_size;
    let rows = client
        .query(
            "SELECT pod_id, date_trunc($1, occurred_at) AS bucket_start, COUNT(*)::bigint AS total \
             FROM analytics_events \
             WHERE pod_id IS NOT NULL \
             GROUP BY pod_id, bucket_start \
             ORDER BY bucket_start DESC, pod_id \
             LIMIT $2 OFFSET $3",
            &[&window.as_trunc_parameter(), &limit, &offset],
        )
        .await?;
    build_pod_buckets(window, page_size, rows)
}

pub async fn aggregate_artifact_events(
    pool: &Pool,
    window: TimeWindow,
    page: i64,
    page_size: i64,
) -> anyhow::Result<Paginated<ArtifactEventBucket>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for aggregate_artifact_events")?;
    let limit = page_size + 1;
    let offset = (page - 1) * page_size;
    let rows = client
        .query(
            "SELECT artifact_id, date_trunc($1, occurred_at) AS bucket_start, COUNT(*)::bigint AS total \
             FROM analytics_events \
             WHERE artifact_id IS NOT NULL \
             GROUP BY artifact_id, bucket_start \
             ORDER BY bucket_start DESC, artifact_id \
             LIMIT $2 OFFSET $3",
            &[&window.as_trunc_parameter(), &limit, &offset],
        )
        .await?;
    build_artifact_buckets(window, page_size, rows)
}

fn build_pod_buckets(
    window: TimeWindow,
    page_size: i64,
    mut rows: Vec<Row>,
) -> anyhow::Result<Paginated<PodEventBucket>> {
    let has_more = if rows.len() as i64 > page_size {
        rows.pop();
        true
    } else {
        false
    };
    let items = rows
        .into_iter()
        .map(|row| {
            let bucket_start: DateTime<Utc> = row.try_get("bucket_start")?;
            let bucket_end = window.bucket_end(bucket_start);
            Ok(PodEventBucket {
                pod_id: row.try_get("pod_id")?,
                bucket: EventBucket {
                    bucket_start,
                    bucket_end,
                    total: row.try_get("total")?,
                },
            })
        })
        .collect::<Result<Vec<_>, tokio_postgres::Error>>()?;
    Ok(Paginated { items, has_more })
}

fn build_artifact_buckets(
    window: TimeWindow,
    page_size: i64,
    mut rows: Vec<Row>,
) -> anyhow::Result<Paginated<ArtifactEventBucket>> {
    let has_more = if rows.len() as i64 > page_size {
        rows.pop();
        true
    } else {
        false
    };
    let items = rows
        .into_iter()
        .map(|row| {
            let bucket_start: DateTime<Utc> = row.try_get("bucket_start")?;
            let bucket_end = window.bucket_end(bucket_start);
            Ok(ArtifactEventBucket {
                artifact_id: row.try_get("artifact_id")?,
                bucket: EventBucket {
                    bucket_start,
                    bucket_end,
                    total: row.try_get("total")?,
                },
            })
        })
        .collect::<Result<Vec<_>, tokio_postgres::Error>>()?;
    Ok(Paginated { items, has_more })
}
