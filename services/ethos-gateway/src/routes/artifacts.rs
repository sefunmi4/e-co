use std::{collections::HashMap, sync::Arc};

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::{
    auth::AuthSession,
    services::artifacts::{self, Artifact, ArtifactChanges},
    state::AppState,
};

type ApiResult<T> = Result<T, (StatusCode, &'static str)>;

#[derive(Debug, Deserialize)]
pub struct CreateArtifactRequest {
    pub artifact_type: String,
    #[serde(default = "default_metadata")]
    pub metadata: Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateArtifactRequest {
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

pub async fn list_artifacts(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> ApiResult<Json<Vec<Artifact>>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_type = params.get("artifact_type").map(String::as_str);
    let artifacts = artifacts::list_artifacts(&state.db, Some(owner_id), artifact_type)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to list artifacts",
            )
        })?;
    Ok(Json(artifacts))
}

pub async fn create_artifact(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateArtifactRequest>,
) -> ApiResult<(StatusCode, Json<Artifact>)> {
    let owner_id = parse_uuid(&auth.user_id)?;
    if body.artifact_type.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Artifact type is required"));
    }
    let artifact =
        artifacts::create_artifact(&state.db, owner_id, body.artifact_type, body.metadata)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to create artifact",
                )
            })?;
    Ok((StatusCode::CREATED, Json(artifact)))
}

pub async fn get_artifact(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(artifact_id): Path<String>,
) -> ApiResult<Json<Artifact>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    let artifact = artifacts::get_artifact_for_owner(&state.db, artifact_id, owner_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load artifact"))?;
    match artifact {
        Some(artifact) => Ok(Json(artifact)),
        None => Err((StatusCode::NOT_FOUND, "Artifact not found")),
    }
}

pub async fn update_artifact(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(artifact_id): Path<String>,
    Json(body): Json<UpdateArtifactRequest>,
) -> ApiResult<Json<Artifact>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    if body
        .artifact_type
        .as_ref()
        .map(|value| value.trim().is_empty())
        .unwrap_or(false)
    {
        return Err((StatusCode::BAD_REQUEST, "Artifact type cannot be empty"));
    }
    let changes = ArtifactChanges {
        artifact_type: body.artifact_type,
        metadata: body.metadata,
    };
    let updated = artifacts::update_artifact(&state.db, artifact_id, owner_id, changes)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to update artifact",
            )
        })?;
    match updated {
        Some(artifact) => Ok(Json(artifact)),
        None => Err((StatusCode::NOT_FOUND, "Artifact not found")),
    }
}

pub async fn delete_artifact(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(artifact_id): Path<String>,
) -> ApiResult<StatusCode> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    let deleted = artifacts::delete_artifact(&state.db, artifact_id, owner_id)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to delete artifact",
            )
        })?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Artifact not found"))
    }
}

fn parse_uuid(value: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(value).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid identifier"))
}

fn default_metadata() -> Value {
    Value::Object(serde_json::Map::new())
}
