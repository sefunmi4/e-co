use std::{collections::HashMap, sync::Arc};

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde_json::Value;

use crate::{auth::AuthSession, state::AppState};

type ApiResult<T> = Result<T, (StatusCode, &'static str)>;

pub async fn list_guilds(
    State(state): State<Arc<AppState>>,
    auth: Option<AuthSession>,
    query: Option<Query<HashMap<String, String>>>,
) -> ApiResult<Json<Vec<Value>>> {
    let raw_filters = query.map(|Query(map)| map).unwrap_or_default();
    let filters = parse_filters(&raw_filters);
    let actor_id = auth.as_ref().map(|session| session.user_id.as_str());
    let guilds = state
        .guild_service
        .list(actor_id, &filters)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list guilds"))?;
    Ok(Json(guilds))
}

pub async fn create_guild(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<Value>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    if !payload.is_object() {
        return Err((StatusCode::BAD_REQUEST, "Guild payload must be an object"));
    }
    let created = state
        .guild_service
        .create(&auth.user_id, payload)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create guild"))?;
    Ok((StatusCode::CREATED, Json(created)))
}

pub async fn get_guild(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
    auth: Option<AuthSession>,
) -> ApiResult<Json<Value>> {
    let actor_id = auth.as_ref().map(|session| session.user_id.as_str());
    let guild = state
        .guild_service
        .get(actor_id, &id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load guild"))?;
    match guild {
        Some(value) => Ok(Json(value)),
        None => Err((StatusCode::NOT_FOUND, "Guild not found")),
    }
}

pub async fn update_guild(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
    auth: AuthSession,
    Json(payload): Json<Value>,
) -> ApiResult<Json<Value>> {
    if !payload.is_object() {
        return Err((StatusCode::BAD_REQUEST, "Guild payload must be an object"));
    }
    let updated = state
        .guild_service
        .update(&auth.user_id, &id, payload)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update guild"))?;
    match updated {
        Some(value) => Ok(Json(value)),
        None => Err((StatusCode::NOT_FOUND, "Guild not found")),
    }
}

pub async fn delete_guild(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
    auth: AuthSession,
) -> ApiResult<StatusCode> {
    let deleted = state
        .guild_service
        .delete(&auth.user_id, &id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete guild"))?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Guild not found"))
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
