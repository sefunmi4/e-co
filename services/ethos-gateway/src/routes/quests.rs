use std::{collections::HashMap, sync::Arc};

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde_json::Value;

use crate::state::AppState;

type ApiResult<T> = Result<T, (StatusCode, &'static str)>;

pub async fn list_quests(
    State(state): State<Arc<AppState>>,
    query: Option<Query<HashMap<String, String>>>,
) -> ApiResult<Json<Vec<Value>>> {
    let raw_filters = query.map(|Query(map)| map).unwrap_or_default();
    let filters = parse_filters(&raw_filters);
    let quests = state
        .quest_service
        .list(&filters)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list quests"))?;
    Ok(Json(quests))
}

pub async fn create_quest(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<Value>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    if !payload.is_object() {
        return Err((StatusCode::BAD_REQUEST, "Quest payload must be an object"));
    }
    let created = state
        .quest_service
        .create(payload)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create quest"))?;
    Ok((StatusCode::CREATED, Json(created)))
}

pub async fn get_quest(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<Value>> {
    let quest = state
        .quest_service
        .get(&id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load quest"))?;
    match quest {
        Some(value) => Ok(Json(value)),
        None => Err((StatusCode::NOT_FOUND, "Quest not found")),
    }
}

pub async fn update_quest(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<Value>,
) -> ApiResult<Json<Value>> {
    if !payload.is_object() {
        return Err((StatusCode::BAD_REQUEST, "Quest payload must be an object"));
    }
    let updated = state
        .quest_service
        .update(&id, payload)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update quest"))?;
    match updated {
        Some(value) => Ok(Json(value)),
        None => Err((StatusCode::NOT_FOUND, "Quest not found")),
    }
}

pub async fn delete_quest(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> ApiResult<StatusCode> {
    let deleted = state
        .quest_service
        .delete(&id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete quest"))?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Quest not found"))
    }
}

fn parse_filters(params: &HashMap<String, String>) -> HashMap<String, Value> {
    params
        .iter()
        .filter_map(|(key, value)| {
            if matches!(key.as_str(), "sort" | "limit" | "page") {
                return None;
            }
            Some((key.clone(), parse_query_value(value)))
        })
        .collect()
}

fn parse_query_value(value: &str) -> Value {
    if let Ok(parsed) = serde_json::from_str(value) {
        parsed
    } else {
        match value {
            "true" => Value::Bool(true),
            "false" => Value::Bool(false),
            _ => Value::String(value.to_string()),
        }
    }
}
