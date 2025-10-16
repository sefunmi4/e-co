use std::{collections::HashMap, convert::Infallible, sync::Arc};

use async_stream::stream;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use futures::Stream;
use serde_json::{json, Value};
use tokio::sync::broadcast;

use crate::{auth, auth::AuthSession, services::QuestEvent, state::AppState};

use super::StreamQuery;

type ApiResult<T> = Result<T, (StatusCode, &'static str)>;

pub async fn list_quests(
    State(state): State<Arc<AppState>>,
    auth: Option<AuthSession>,
    query: Option<Query<HashMap<String, String>>>,
) -> ApiResult<Json<Vec<Value>>> {
    let raw_filters = query.map(|Query(map)| map).unwrap_or_default();
    let filters = parse_filters(&raw_filters);
    let actor_id = auth.as_ref().map(|session| session.user_id.as_str());
    let quests = state
        .quest_service
        .list(actor_id, &filters)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list quests"))?;
    Ok(Json(quests))
}

pub async fn create_quest(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<Value>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    if !payload.is_object() {
        return Err((StatusCode::BAD_REQUEST, "Quest payload must be an object"));
    }
    let created = state
        .quest_service
        .create(&auth.user_id, payload)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create quest"))?;
    Ok((StatusCode::CREATED, Json(created)))
}

pub async fn get_quest(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
    auth: Option<AuthSession>,
) -> ApiResult<Json<Value>> {
    let actor_id = auth.as_ref().map(|session| session.user_id.as_str());
    let quest = state
        .quest_service
        .get(actor_id, &id)
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
    auth: AuthSession,
    Json(payload): Json<Value>,
) -> ApiResult<Json<Value>> {
    if !payload.is_object() {
        return Err((StatusCode::BAD_REQUEST, "Quest payload must be an object"));
    }
    let updated = state
        .quest_service
        .update(&auth.user_id, &id, payload)
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
    auth: AuthSession,
) -> ApiResult<StatusCode> {
    let deleted = state
        .quest_service
        .delete(&auth.user_id, &id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete quest"))?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Quest not found"))
    }
}

pub async fn list_quest_applications(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
    auth: AuthSession,
) -> ApiResult<Json<Vec<Value>>> {
    let quest = state
        .quest_service
        .get(None, &id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load quest"))?;
    if quest.is_none() {
        return Err((StatusCode::NOT_FOUND, "Quest not found"));
    }
    let applications = state
        .quest_service
        .list_applications(&auth.user_id, &id)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to list quest applications",
            )
        })?;
    Ok(Json(applications))
}

pub async fn apply_to_quest(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
    auth: AuthSession,
    payload: Option<Json<Value>>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let quest = state
        .quest_service
        .get(None, &id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load quest"))?;
    let Some(quest) = quest else {
        return Err((StatusCode::NOT_FOUND, "Quest not found"));
    };
    if quest.get("creator_id").and_then(Value::as_str) == Some(auth.user_id.as_str()) {
        return Err((
            StatusCode::FORBIDDEN,
            "Quest creators cannot apply to their own quest",
        ));
    }
    let payload_value = payload.map(|Json(value)| value).unwrap_or(Value::Null);
    if !matches!(payload_value, Value::Null | Value::Object(_)) {
        return Err((
            StatusCode::BAD_REQUEST,
            "Application payload must be an object",
        ));
    }
    let application = state
        .quest_service
        .apply(&auth.user_id, &id, payload_value)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to apply to quest",
            )
        })?;
    match application {
        Some(value) => Ok((StatusCode::CREATED, Json(value))),
        None => Err((
            StatusCode::CONFLICT,
            "Quest application could not be created",
        )),
    }
}

pub async fn approve_quest_application(
    Path((quest_id, application_id)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
    auth: AuthSession,
    payload: Option<Json<Value>>,
) -> ApiResult<Json<Value>> {
    let quest = state
        .quest_service
        .get(None, &quest_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load quest"))?;
    let Some(quest) = quest else {
        return Err((StatusCode::NOT_FOUND, "Quest not found"));
    };
    if quest.get("creator_id").and_then(Value::as_str) != Some(auth.user_id.as_str()) {
        return Err((
            StatusCode::FORBIDDEN,
            "Only quest owners may approve applications",
        ));
    }
    let payload_value = payload.map(|Json(value)| value).unwrap_or(Value::Null);
    if !matches!(payload_value, Value::Null | Value::Object(_)) {
        return Err((
            StatusCode::BAD_REQUEST,
            "Approval payload must be an object",
        ));
    }
    let application = state
        .quest_service
        .approve_application(&auth.user_id, &quest_id, &application_id, payload_value)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to approve quest application",
            )
        })?;
    match application {
        Some(value) => Ok(Json(value)),
        None => Err((StatusCode::NOT_FOUND, "Quest application not found")),
    }
}

pub async fn reject_quest_application(
    Path((quest_id, application_id)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
    auth: AuthSession,
    payload: Option<Json<Value>>,
) -> ApiResult<Json<Value>> {
    let quest = state
        .quest_service
        .get(None, &quest_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load quest"))?;
    let Some(quest) = quest else {
        return Err((StatusCode::NOT_FOUND, "Quest not found"));
    };
    if quest.get("creator_id").and_then(Value::as_str) != Some(auth.user_id.as_str()) {
        return Err((
            StatusCode::FORBIDDEN,
            "Only quest owners may reject applications",
        ));
    }
    let payload_value = payload.map(|Json(value)| value).unwrap_or(Value::Null);
    if !matches!(payload_value, Value::Null | Value::Object(_)) {
        return Err((
            StatusCode::BAD_REQUEST,
            "Rejection payload must be an object",
        ));
    }
    let application = state
        .quest_service
        .reject_application(&auth.user_id, &quest_id, &application_id, payload_value)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to reject quest application",
            )
        })?;
    match application {
        Some(value) => Ok(Json(value)),
        None => Err((StatusCode::NOT_FOUND, "Quest application not found")),
    }
}

pub async fn stream_quest(
    Query(query): Query<StreamQuery>,
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    let claims = auth::decode_token(&state.config.jwt_secret, &query.token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let quest = state
        .quest_service
        .get(None, &id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let Some(quest) = quest else {
        return Err(StatusCode::NOT_FOUND);
    };
    let applications = state
        .quest_service
        .list_applications(&claims.sub, &id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut receiver = state
        .quest_service
        .subscribe(&id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let quest_id = id.clone();
    let initial_events = vec![
        QuestEvent {
            quest_id: quest_id.clone(),
            event: "quest.snapshot".to_string(),
            data: json!({ "quest": quest.clone() }),
        },
        QuestEvent {
            quest_id: quest_id.clone(),
            event: "applications.snapshot".to_string(),
            data: json!({ "applications": applications }),
        },
    ];

    let stream = stream! {
        for event in initial_events {
            match Event::default().event(&event.event).json_data(&event) {
                Ok(payload) => yield Ok(payload),
                Err(error) => tracing::warn!(?error, "failed to serialise quest snapshot event"),
            }
        }

        loop {
            match receiver.recv().await {
                Ok(event) => match Event::default().event(&event.event).json_data(&event) {
                    Ok(payload) => yield Ok(payload),
                    Err(error) => tracing::warn!(?error, "failed to serialise quest event"),
                },
                Err(broadcast::error::RecvError::Lagged(skipped)) => {
                    tracing::warn!(%quest_id, skipped, "quest event stream lagging");
                }
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
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
