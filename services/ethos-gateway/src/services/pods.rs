use anyhow::Context;
use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use tokio_postgres::Row;
use uuid::Uuid;

use super::{
    artifacts::{self, Artifact},
    pod_items,
    pod_items::PodItem,
};

const POD_SNAPSHOT_TYPE: &str = "pod_snapshot";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pod {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Pod {
    fn from_row(row: &Row) -> Result<Self, tokio_postgres::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            owner_id: row.try_get("owner_id")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodSnapshot {
    pub artifact_id: Uuid,
    pub owner_id: Uuid,
    pub pod: Pod,
    pub items: Vec<PodItem>,
    pub published_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PodSnapshotMetadata {
    pub pod: Pod,
    pub items: Vec<PodItem>,
    pub published_at: DateTime<Utc>,
    #[serde(default)]
    pub is_public: bool,
}

#[derive(Debug, Clone, Default)]
pub struct PodChanges {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
}

pub async fn list_pods(pool: &Pool, owner_id: Option<Uuid>) -> anyhow::Result<Vec<Pod>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for list_pods")?;
    let rows = match owner_id {
        Some(owner_id) => {
            client
                .query(
                    "SELECT id, owner_id, title, description, created_at, updated_at \
                     FROM pods WHERE owner_id = $1 ORDER BY created_at DESC",
                    &[&owner_id],
                )
                .await?
        }
        None => {
            client
                .query(
                    "SELECT id, owner_id, title, description, created_at, updated_at \
                     FROM pods ORDER BY created_at DESC",
                    &[],
                )
                .await?
        }
    };
    rows.into_iter()
        .map(|row| Pod::from_row(&row).map_err(anyhow::Error::from))
        .collect()
}

pub async fn get_pod(pool: &Pool, id: Uuid) -> anyhow::Result<Option<Pod>> {
    let client = pool.get().await.context("acquire connection for get_pod")?;
    let row = client
        .query_opt(
            "SELECT id, owner_id, title, description, created_at, updated_at FROM pods WHERE id = $1",
            &[&id],
        )
        .await?;
    match row {
        Some(row) => Ok(Some(Pod::from_row(&row)?)),
        None => Ok(None),
    }
}

pub async fn create_pod(
    pool: &Pool,
    owner_id: Uuid,
    title: String,
    description: Option<String>,
) -> anyhow::Result<Pod> {
    let client = pool
        .get()
        .await
        .context("acquire connection for create_pod")?;
    let id = Uuid::new_v4();
    let normalized_description = normalize_text(description);
    let description_param: Option<&str> = normalized_description.as_deref();
    let row = client
        .query_one(
            "INSERT INTO pods (id, owner_id, title, description) \
             VALUES ($1, $2, $3, $4) \
             RETURNING id, owner_id, title, description, created_at, updated_at",
            &[&id, &owner_id, &title, &description_param],
        )
        .await?;
    Pod::from_row(&row).map_err(anyhow::Error::from)
}

pub async fn update_pod(
    pool: &Pool,
    id: Uuid,
    owner_id: Uuid,
    mut changes: PodChanges,
) -> anyhow::Result<Option<Pod>> {
    let mut client = pool
        .get()
        .await
        .context("acquire connection for update_pod")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for update_pod")?;
    let row = transaction
        .query_opt(
            "SELECT id, owner_id, title, description, created_at, updated_at \
             FROM pods WHERE id = $1 FOR UPDATE",
            &[&id],
        )
        .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let mut pod = Pod::from_row(&row)?;
    if pod.owner_id != owner_id {
        return Ok(None);
    }
    if let Some(title) = changes.title.take() {
        if !title.trim().is_empty() {
            pod.title = title;
        }
    }
    if let Some(description) = changes.description.take() {
        pod.description = normalize_text(description);
    }
    pod.updated_at = Utc::now();
    let description_param: Option<&str> = pod.description.as_deref();
    let row = transaction
        .query_one(
            "UPDATE pods \
             SET title = $2, description = $3, updated_at = $4 \
             WHERE id = $1 \
             RETURNING id, owner_id, title, description, created_at, updated_at",
            &[&pod.id, &pod.title, &description_param, &pod.updated_at],
        )
        .await?;
    transaction
        .commit()
        .await
        .context("commit update_pod transaction")?;
    Pod::from_row(&row).map(Some).map_err(anyhow::Error::from)
}

pub async fn delete_pod(pool: &Pool, id: Uuid, owner_id: Uuid) -> anyhow::Result<bool> {
    let client = pool
        .get()
        .await
        .context("acquire connection for delete_pod")?;
    let deleted = client
        .execute(
            "DELETE FROM pods WHERE id = $1 AND owner_id = $2",
            &[&id, &owner_id],
        )
        .await?;
    Ok(deleted > 0)
}

pub async fn publish_pod_snapshot(
    pool: &Pool,
    pod_id: Uuid,
    owner_id: Uuid,
) -> anyhow::Result<Option<PodSnapshot>> {
    let pod = match get_pod(pool, pod_id).await? {
        Some(pod) if pod.owner_id == owner_id => pod,
        _ => return Ok(None),
    };
    let items = pod_items::list_by_pod(pool, pod_id, false).await?;
    let metadata = PodSnapshotMetadata {
        pod: pod.clone(),
        items: items.clone(),
        published_at: Utc::now(),
        is_public: true,
    };
    let payload = serde_json::to_value(&metadata)?;
    let artifact =
        artifacts::create_artifact(pool, owner_id, POD_SNAPSHOT_TYPE.to_string(), payload).await?;
    Ok(Some(PodSnapshot {
        artifact_id: artifact.id,
        owner_id: artifact.owner_id,
        pod,
        items,
        published_at: metadata.published_at,
    }))
}

pub async fn list_public_snapshots(pool: &Pool) -> anyhow::Result<Vec<PodSnapshot>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for list_public_snapshots")?;
    let rows = client
        .query(
            "SELECT id, owner_id, artifact_type, metadata, created_at \
             FROM artifacts \
             WHERE artifact_type = $1 \
               AND COALESCE((metadata->>'is_public')::boolean, false) = true \
             ORDER BY created_at DESC",
            &[&POD_SNAPSHOT_TYPE],
        )
        .await?;
    let mut snapshots = Vec::new();
    for row in rows {
        let artifact = Artifact::from_row(&row)?;
        let metadata: PodSnapshotMetadata = serde_json::from_value(artifact.metadata.clone())
            .context("decode pod snapshot metadata")?;
        snapshots.push(PodSnapshot {
            artifact_id: artifact.id,
            owner_id: artifact.owner_id,
            pod: metadata.pod,
            items: metadata.items,
            published_at: metadata.published_at,
        });
    }
    Ok(snapshots)
}

fn normalize_text(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_owned())
        }
    })
}
