use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::{
    auth::AuthSession,
    services::{
        pod_items::{self, PodItem, PodItemChanges, DEFAULT_VISIBILITY},
        pods,
    },
    state::AppState,
};

type ApiResult<T> = Result<T, (StatusCode, &'static str)>;

#[derive(Debug, Deserialize)]
pub struct CreatePodItemRequest {
    #[serde(default)]
    pub artifact_id: Option<Uuid>,
    pub item_type: String,
    #[serde(default = "default_json_null")]
    pub item_data: Value,
    #[serde(default)]
    pub position: Option<i32>,
    #[serde(default)]
    pub visibility: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePodItemRequest {
    #[serde(default)]
    pub artifact_id: Option<Option<Uuid>>,
    #[serde(default)]
    pub item_type: Option<String>,
    #[serde(default)]
    pub item_data: Option<Value>,
    #[serde(default)]
    pub position: Option<i32>,
    #[serde(default)]
    pub visibility: Option<String>,
}

pub async fn list_pod_items(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(pod_id): Path<String>,
) -> ApiResult<Json<Vec<PodItem>>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let pod_id = parse_uuid(&pod_id)?;
    ensure_pod_ownership(&state, pod_id, owner_id).await?;
    let items = pod_items::list_by_pod(&state.db, pod_id, true)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to list pod items",
            )
        })?;
    Ok(Json(items))
}

pub async fn create_pod_item(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(pod_id): Path<String>,
    Json(body): Json<CreatePodItemRequest>,
) -> ApiResult<(StatusCode, Json<PodItem>)> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let pod_id = parse_uuid(&pod_id)?;
    ensure_pod_ownership(&state, pod_id, owner_id).await?;
    if body.item_type.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Item type is required"));
    }
    let visibility = normalize_visibility(body.visibility)
        .map_err(|message| (StatusCode::BAD_REQUEST, message))?;
    let item = pod_items::create_pod_item(
        &state.db,
        pod_id,
        body.artifact_id,
        body.item_type,
        body.item_data,
        body.position,
        visibility,
    )
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to create pod item",
        )
    })?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn get_pod_item(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path((pod_id, item_id)): Path<(String, String)>,
) -> ApiResult<Json<PodItem>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let pod_id = parse_uuid(&pod_id)?;
    let item_id = parse_uuid(&item_id)?;
    ensure_pod_ownership(&state, pod_id, owner_id).await?;
    let item = pod_items::get_pod_item(&state.db, item_id, true)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load pod item"))?;
    match item {
        Some(item) if item.pod_id == pod_id => Ok(Json(item)),
        _ => Err((StatusCode::NOT_FOUND, "Pod item not found")),
    }
}

pub async fn update_pod_item(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path((pod_id, item_id)): Path<(String, String)>,
    Json(body): Json<UpdatePodItemRequest>,
) -> ApiResult<Json<PodItem>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let pod_id = parse_uuid(&pod_id)?;
    let item_id = parse_uuid(&item_id)?;
    ensure_pod_ownership(&state, pod_id, owner_id).await?;
    if body
        .item_type
        .as_ref()
        .map(|value| value.trim().is_empty())
        .unwrap_or(false)
    {
        return Err((StatusCode::BAD_REQUEST, "Item type cannot be empty"));
    }
    let visibility = normalize_visibility_optional(body.visibility)
        .map_err(|message| (StatusCode::BAD_REQUEST, message))?;
    let changes = PodItemChanges {
        artifact_id: body.artifact_id,
        item_type: body.item_type,
        item_data: body.item_data,
        position: body.position,
        visibility,
    };
    let updated = pod_items::update_pod_item(&state.db, item_id, changes)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to update pod item",
            )
        })?;
    match updated {
        Some(item) if item.pod_id == pod_id => Ok(Json(item)),
        _ => Err((StatusCode::NOT_FOUND, "Pod item not found")),
    }
}

pub async fn delete_pod_item(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path((pod_id, item_id)): Path<(String, String)>,
) -> ApiResult<StatusCode> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let pod_id = parse_uuid(&pod_id)?;
    let item_id = parse_uuid(&item_id)?;
    ensure_pod_ownership(&state, pod_id, owner_id).await?;
    let item = pod_items::get_pod_item(&state.db, item_id, true)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to delete pod item",
            )
        })?;
    let Some(item) = item else {
        return Err((StatusCode::NOT_FOUND, "Pod item not found"));
    };
    if item.pod_id != pod_id {
        return Err((StatusCode::NOT_FOUND, "Pod item not found"));
    }
    let deleted = pod_items::delete_pod_item(&state.db, item_id)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to delete pod item",
            )
        })?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Pod item not found"))
    }
}

async fn ensure_pod_ownership(
    state: &Arc<AppState>,
    pod_id: Uuid,
    owner_id: Uuid,
) -> ApiResult<()> {
    let pod = pods::get_pod(&state.db, pod_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to verify pod"))?;
    match pod {
        Some(pod) if pod.owner_id == owner_id => Ok(()),
        _ => Err((StatusCode::NOT_FOUND, "Pod not found")),
    }
}

fn parse_uuid(value: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(value).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid identifier"))
}

fn default_json_null() -> Value {
    Value::Null
}

fn normalize_visibility(value: Option<String>) -> Result<String, &'static str> {
    match normalize_visibility_optional(value)? {
        Some(value) => Ok(value),
        None => Ok(DEFAULT_VISIBILITY.to_string()),
    }
}

fn normalize_visibility_optional(value: Option<String>) -> Result<Option<String>, &'static str> {
    let Some(value) = value else {
        return Ok(None);
    };
    let normalized = value.trim().to_lowercase();
    if normalized.is_empty() {
        return Err("Visibility cannot be empty");
    }
    match normalized.as_str() {
        "public" | "hidden" => Ok(Some(normalized)),
        _ => Err("Invalid visibility value"),
    }
}
