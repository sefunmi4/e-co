use anyhow::Context;
use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio_postgres::{types::Json as PgJson, Row};
use uuid::Uuid;

pub const DEFAULT_VISIBILITY: &str = "public";

fn default_visibility() -> String {
    DEFAULT_VISIBILITY.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodItem {
    pub id: Uuid,
    pub pod_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifact_id: Option<Uuid>,
    pub item_type: String,
    pub item_data: Value,
    pub position: i32,
    #[serde(default = "default_visibility")]
    pub visibility: String,
    pub created_at: DateTime<Utc>,
}

impl PodItem {
    pub(crate) fn from_row(row: &Row) -> Result<Self, tokio_postgres::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            pod_id: row.try_get("pod_id")?,
            artifact_id: row.try_get("artifact_id")?,
            item_type: row.try_get("item_type")?,
            item_data: row.try_get("item_data")?,
            position: row.try_get("position")?,
            visibility: row
                .try_get("visibility")
                .unwrap_or_else(|_| default_visibility()),
            created_at: row.try_get("created_at")?,
        })
    }
}

#[derive(Debug, Clone, Default)]
pub struct PodItemChanges {
    pub artifact_id: Option<Option<Uuid>>,
    pub item_type: Option<String>,
    pub item_data: Option<Value>,
    pub position: Option<i32>,
    pub visibility: Option<String>,
}

pub async fn list_by_pod(
    pool: &Pool,
    pod_id: Uuid,
    include_hidden: bool,
) -> anyhow::Result<Vec<PodItem>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for list_by_pod")?;
    let rows = client
        .query(
            "SELECT id, pod_id, artifact_id, item_type, item_data, position, visibility, created_at \
             FROM pod_items \
             WHERE pod_id = $1 AND ($2 OR visibility = $3) \
             ORDER BY position ASC, created_at ASC",
            &[&pod_id, &include_hidden, &DEFAULT_VISIBILITY],
        )
        .await?;
    rows.into_iter()
        .map(|row| PodItem::from_row(&row).map_err(anyhow::Error::from))
        .collect()
}

pub async fn get_pod_item(
    pool: &Pool,
    id: Uuid,
    include_hidden: bool,
) -> anyhow::Result<Option<PodItem>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for get_pod_item")?;
    let row = client
        .query_opt(
            "SELECT id, pod_id, artifact_id, item_type, item_data, position, visibility, created_at \
             FROM pod_items WHERE id = $1 AND ($2 OR visibility = $3)",
            &[&id, &include_hidden, &DEFAULT_VISIBILITY],
        )
        .await?;
    match row {
        Some(row) => Ok(Some(PodItem::from_row(&row)?)),
        None => Ok(None),
    }
}

pub async fn create_pod_item(
    pool: &Pool,
    pod_id: Uuid,
    artifact_id: Option<Uuid>,
    item_type: String,
    item_data: Value,
    position: Option<i32>,
    visibility: String,
) -> anyhow::Result<PodItem> {
    let client = pool
        .get()
        .await
        .context("acquire connection for create_pod_item")?;
    let id = Uuid::new_v4();
    let stored_data = PgJson(item_data);
    let visibility = if visibility.trim().is_empty() {
        DEFAULT_VISIBILITY.to_string()
    } else {
        visibility
    };
    let position = match position {
        Some(position) => position,
        None => {
            let row = client
                .query_one(
                    "SELECT COALESCE(MAX(position) + 1, 0) FROM pod_items WHERE pod_id = $1",
                    &[&pod_id],
                )
                .await?;
            row.try_get(0)?
        }
    };
    let row = client
        .query_one(
            "INSERT INTO pod_items (id, pod_id, artifact_id, item_type, item_data, position, visibility) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) \
             RETURNING id, pod_id, artifact_id, item_type, item_data, position, visibility, created_at",
            &[
                &id,
                &pod_id,
                &artifact_id,
                &item_type,
                &stored_data,
                &position,
                &visibility,
            ],
        )
        .await?;
    PodItem::from_row(&row).map_err(anyhow::Error::from)
}

pub async fn update_pod_item(
    pool: &Pool,
    id: Uuid,
    mut changes: PodItemChanges,
) -> anyhow::Result<Option<PodItem>> {
    let mut client = pool
        .get()
        .await
        .context("acquire connection for update_pod_item")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for update_pod_item")?;
    let row = transaction
        .query_opt(
            "SELECT id, pod_id, artifact_id, item_type, item_data, position, visibility, created_at \
             FROM pod_items WHERE id = $1 FOR UPDATE",
            &[&id],
        )
        .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let mut item = PodItem::from_row(&row)?;
    if let Some(artifact_id) = changes.artifact_id.take() {
        item.artifact_id = artifact_id;
    }
    if let Some(item_type) = changes.item_type.take() {
        item.item_type = item_type;
    }
    if let Some(item_data) = changes.item_data.take() {
        item.item_data = item_data;
    }
    if let Some(position) = changes.position.take() {
        item.position = position;
    }
    if let Some(visibility) = changes.visibility.take() {
        if visibility.trim().is_empty() {
            item.visibility = DEFAULT_VISIBILITY.to_string();
        } else {
            item.visibility = visibility;
        }
    }
    let stored_data = PgJson(item.item_data.clone());
    let row = transaction
        .query_one(
            "UPDATE pod_items \
             SET artifact_id = $2, item_type = $3, item_data = $4, position = $5, visibility = $6 \
             WHERE id = $1 \
             RETURNING id, pod_id, artifact_id, item_type, item_data, position, visibility, created_at",
            &[
                &item.id,
                &item.artifact_id,
                &item.item_type,
                &stored_data,
                &item.position,
                &item.visibility,
            ],
        )
        .await?;
    transaction
        .commit()
        .await
        .context("commit update_pod_item transaction")?;
    PodItem::from_row(&row)
        .map(Some)
        .map_err(anyhow::Error::from)
}

pub async fn delete_pod_item(pool: &Pool, id: Uuid) -> anyhow::Result<bool> {
    let client = pool
        .get()
        .await
        .context("acquire connection for delete_pod_item")?;
    let deleted = client
        .execute("DELETE FROM pod_items WHERE id = $1", &[&id])
        .await?;
    Ok(deleted > 0)
}
