use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    auth::AuthSession,
    services::pods::{self, Pod, PodChanges, PodSnapshot},
    state::AppState,
};

type ApiResult<T> = Result<T, (StatusCode, &'static str)>;

#[derive(Debug, Deserialize)]
pub struct CreatePodRequest {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePodRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<Option<String>>,
}

pub async fn list_pods(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<Vec<Pod>>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let pods = pods::list_pods(&state.db, Some(owner_id))
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list pods"))?;
    Ok(Json(pods))
}

pub async fn create_pod(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreatePodRequest>,
) -> ApiResult<(StatusCode, Json<Pod>)> {
    let owner_id = parse_uuid(&auth.user_id)?;
    if body.title.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Pod title is required"));
    }
    let pod = pods::create_pod(&state.db, owner_id, body.title, body.description)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create pod"))?;
    Ok((StatusCode::CREATED, Json(pod)))
}

pub async fn get_pod(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(pod_id): Path<String>,
) -> ApiResult<Json<Pod>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let pod_id = parse_uuid(&pod_id)?;
    let pod = pods::get_pod(&state.db, pod_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load pod"))?;
    match pod {
        Some(pod) if pod.owner_id == owner_id => Ok(Json(pod)),
        Some(_) => Err((StatusCode::NOT_FOUND, "Pod not found")),
        None => Err((StatusCode::NOT_FOUND, "Pod not found")),
    }
}

pub async fn update_pod(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(pod_id): Path<String>,
    Json(body): Json<UpdatePodRequest>,
) -> ApiResult<Json<Pod>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let pod_id = parse_uuid(&pod_id)?;
    if body
        .title
        .as_ref()
        .map(|value| value.trim().is_empty())
        .unwrap_or(false)
    {
        return Err((StatusCode::BAD_REQUEST, "Pod title cannot be empty"));
    }
    let changes = PodChanges {
        title: body.title,
        description: body.description,
    };
    let updated = pods::update_pod(&state.db, pod_id, owner_id, changes)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update pod"))?;
    match updated {
        Some(pod) => Ok(Json(pod)),
        None => Err((StatusCode::NOT_FOUND, "Pod not found")),
    }
}

pub async fn delete_pod(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(pod_id): Path<String>,
) -> ApiResult<StatusCode> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let pod_id = parse_uuid(&pod_id)?;
    let deleted = pods::delete_pod(&state.db, pod_id, owner_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete pod"))?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Pod not found"))
    }
}

pub async fn publish_pod(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(pod_id): Path<String>,
) -> ApiResult<(StatusCode, Json<PodSnapshot>)> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let pod_id = parse_uuid(&pod_id)?;
    let snapshot = pods::publish_pod_snapshot(&state.db, pod_id, owner_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to publish pod"))?;
    match snapshot {
        Some(snapshot) => Ok((StatusCode::CREATED, Json(snapshot))),
        None => Err((StatusCode::NOT_FOUND, "Pod not found")),
    }
}

pub async fn list_public_pods(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<Vec<PodSnapshot>>> {
    let snapshots = pods::list_public_snapshots(&state.db)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list pods"))?;
    Ok(Json(snapshots))
}

fn parse_uuid(value: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(value).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid identifier"))
}
