use anyhow::Context;
use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio_postgres::{types::Json as PgJson, Row};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub artifact_type: String,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
}

impl Artifact {
    pub(crate) fn from_row(row: &Row) -> Result<Self, tokio_postgres::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            owner_id: row.try_get("owner_id")?,
            artifact_type: row.try_get("artifact_type")?,
            metadata: row.try_get("metadata")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

#[derive(Debug, Clone, Default)]
pub struct ArtifactChanges {
    pub artifact_type: Option<String>,
    pub metadata: Option<Value>,
}

pub async fn list_artifacts(
    pool: &Pool,
    owner_id: Option<Uuid>,
    artifact_type: Option<&str>,
) -> anyhow::Result<Vec<Artifact>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for list_artifacts")?;
    let rows = match (owner_id, artifact_type) {
        (Some(owner_id), Some(artifact_type)) => {
            client
                .query(
                    "SELECT id, owner_id, artifact_type, metadata, created_at \
                     FROM artifacts WHERE owner_id = $1 AND artifact_type = $2 \
                     ORDER BY created_at DESC",
                    &[&owner_id, &artifact_type],
                )
                .await?
        }
        (Some(owner_id), None) => {
            client
                .query(
                    "SELECT id, owner_id, artifact_type, metadata, created_at \
                     FROM artifacts WHERE owner_id = $1 ORDER BY created_at DESC",
                    &[&owner_id],
                )
                .await?
        }
        (None, Some(artifact_type)) => {
            client
                .query(
                    "SELECT id, owner_id, artifact_type, metadata, created_at \
                     FROM artifacts WHERE artifact_type = $1 ORDER BY created_at DESC",
                    &[&artifact_type],
                )
                .await?
        }
        (None, None) => {
            client
                .query(
                    "SELECT id, owner_id, artifact_type, metadata, created_at \
                     FROM artifacts ORDER BY created_at DESC",
                    &[],
                )
                .await?
        }
    };
    rows.into_iter()
        .map(|row| Artifact::from_row(&row).map_err(anyhow::Error::from))
        .collect()
}

pub async fn get_artifact(pool: &Pool, id: Uuid) -> anyhow::Result<Option<Artifact>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for get_artifact")?;
    let row = client
        .query_opt(
            "SELECT id, owner_id, artifact_type, metadata, created_at FROM artifacts WHERE id = $1",
            &[&id],
        )
        .await?;
    match row {
        Some(row) => Ok(Some(Artifact::from_row(&row)?)),
        None => Ok(None),
    }
}

pub async fn get_artifact_for_owner(
    pool: &Pool,
    id: Uuid,
    owner_id: Uuid,
) -> anyhow::Result<Option<Artifact>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for get_artifact_for_owner")?;
    let row = client
        .query_opt(
            "SELECT id, owner_id, artifact_type, metadata, created_at \
             FROM artifacts WHERE id = $1 AND owner_id = $2",
            &[&id, &owner_id],
        )
        .await?;
    match row {
        Some(row) => Ok(Some(Artifact::from_row(&row)?)),
        None => Ok(None),
    }
}

pub async fn create_artifact(
    pool: &Pool,
    owner_id: Uuid,
    artifact_type: String,
    metadata: Value,
) -> anyhow::Result<Artifact> {
    let client = pool
        .get()
        .await
        .context("acquire connection for create_artifact")?;
    let id = Uuid::new_v4();
    let stored_metadata = PgJson(metadata);
    let row = client
        .query_one(
            "INSERT INTO artifacts (id, owner_id, artifact_type, metadata) \
             VALUES ($1, $2, $3, $4) \
             RETURNING id, owner_id, artifact_type, metadata, created_at",
            &[&id, &owner_id, &artifact_type, &stored_metadata],
        )
        .await?;
    Artifact::from_row(&row).map_err(anyhow::Error::from)
}

pub async fn update_artifact(
    pool: &Pool,
    id: Uuid,
    owner_id: Uuid,
    mut changes: ArtifactChanges,
) -> anyhow::Result<Option<Artifact>> {
    let mut client = pool
        .get()
        .await
        .context("acquire connection for update_artifact")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for update_artifact")?;
    let row = transaction
        .query_opt(
            "SELECT id, owner_id, artifact_type, metadata, created_at \
             FROM artifacts WHERE id = $1 FOR UPDATE",
            &[&id],
        )
        .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let mut artifact = Artifact::from_row(&row)?;
    if artifact.owner_id != owner_id {
        return Ok(None);
    }
    if let Some(artifact_type) = changes.artifact_type.take() {
        artifact.artifact_type = artifact_type;
    }
    if let Some(metadata) = changes.metadata.take() {
        artifact.metadata = metadata;
    }
    let stored_metadata = PgJson(artifact.metadata.clone());
    let row = transaction
        .query_one(
            "UPDATE artifacts \
             SET artifact_type = $2, metadata = $3 \
             WHERE id = $1 \
             RETURNING id, owner_id, artifact_type, metadata, created_at",
            &[&artifact.id, &artifact.artifact_type, &stored_metadata],
        )
        .await?;
    transaction
        .commit()
        .await
        .context("commit update_artifact transaction")?;
    Artifact::from_row(&row)
        .map(Some)
        .map_err(anyhow::Error::from)
}

pub async fn delete_artifact(pool: &Pool, id: Uuid, owner_id: Uuid) -> anyhow::Result<bool> {
    let client = pool
        .get()
        .await
        .context("acquire connection for delete_artifact")?;
    let deleted = client
        .execute(
            "DELETE FROM artifacts WHERE id = $1 AND owner_id = $2",
            &[&id, &owner_id],
        )
        .await?;
    Ok(deleted > 0)
}
