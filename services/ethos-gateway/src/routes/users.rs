use std::{collections::HashMap, sync::Arc};

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{map::Entry, Map, Value};
use tokio_postgres::{types::Json as PgJson, Row};
use tracing::{error, warn};
use uuid::Uuid;

use crate::{auth::AuthSession, state::AppState};

type ApiResult<T> = Result<T, (StatusCode, &'static str)>;

#[derive(Debug, Serialize)]
pub struct UserProfileResponse {
    pub id: String,
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    pub is_guest: bool,
    #[serde(flatten)]
    pub profile: Map<String, Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    #[serde(default)]
    pub display_name: Option<Option<String>>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

pub async fn me(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<UserProfileResponse>> {
    let user_id = parse_user_id(&auth.user_id)?;

    let client = state.db.get().await.map_err(|error| {
        error!(
            ?error,
            "failed to acquire database connection while fetching user profile"
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch user profile",
        )
    })?;

    let row = client
        .query_opt(
            "SELECT id, email, display_name, is_guest, profile FROM users WHERE id = $1",
            &[&user_id],
        )
        .await
        .map_err(|error| {
            error!(?error, "failed to fetch user profile");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to fetch user profile",
            )
        })?
        .ok_or((StatusCode::NOT_FOUND, "User not found"))?;

    let response = build_user_profile_response(row).map_err(|error| {
        error!(?error, "failed to serialize user profile");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch user profile",
        )
    })?;

    Ok(Json(response))
}

pub async fn update_me(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Json(mut payload): Json<UpdateUserRequest>,
) -> ApiResult<Json<UserProfileResponse>> {
    let user_id = parse_user_id(&auth.user_id)?;

    let mut client = state.db.get().await.map_err(|error| {
        error!(
            ?error,
            "failed to acquire database connection while updating user profile"
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to update user profile",
        )
    })?;

    let transaction = client.transaction().await.map_err(|error| {
        error!(
            ?error,
            "failed to start transaction while updating user profile"
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to update user profile",
        )
    })?;

    let row = transaction
        .query_opt(
            "SELECT id, email, display_name, is_guest, profile FROM users WHERE id = $1 FOR UPDATE",
            &[&user_id],
        )
        .await
        .map_err(|error| {
            error!(?error, "failed to fetch user profile for update");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to update user profile",
            )
        })?
        .ok_or((StatusCode::NOT_FOUND, "User not found"))?;

    let mut display_name: Option<String> = row.try_get("display_name").map_err(|error| {
        error!(
            ?error,
            "failed to decode display_name during profile update"
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to update user profile",
        )
    })?;
    let mut profile = load_profile_map(row)?;

    if let Some(display_name_override) = payload.display_name.take() {
        display_name = normalize_optional_string(display_name_override);
    }

    sanitize_reserved_keys(&mut payload.extra);
    for (key, value) in payload.extra.into_iter() {
        profile.insert(key, value);
    }

    let stored_profile = PgJson(Value::Object(profile.clone()));

    let updated_row = transaction
        .query_one(
            "UPDATE users SET display_name = $2, profile = $3 WHERE id = $1 RETURNING id, email, display_name, is_guest, profile",
            &[&user_id, &display_name, &stored_profile],
        )
        .await
        .map_err(|error| {
            error!(?error, "failed to persist user profile updates");
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update user profile")
        })?;

    transaction.commit().await.map_err(|error| {
        error!(?error, "failed to commit user profile transaction");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to update user profile",
        )
    })?;

    let response = build_user_profile_response(updated_row).map_err(|error| {
        error!(?error, "failed to serialize updated user profile");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to update user profile",
        )
    })?;

    Ok(Json(response))
}

fn parse_user_id(id: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(id).map_err(|error| {
        warn!(?error, "received invalid user identifier");
        (StatusCode::BAD_REQUEST, "Invalid user identifier")
    })
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_owned())
        }
    })
}

fn sanitize_reserved_keys(values: &mut HashMap<String, Value>) {
    const RESERVED: &[&str] = &["id", "email", "display_name", "is_guest", "profile"];
    for key in RESERVED {
        values.remove(*key);
    }
}

fn load_profile_map(row: Row) -> ApiResult<Map<String, Value>> {
    let profile_value: PgJson<Value> = row.try_get("profile").map_err(|error| {
        error!(?error, "failed to decode profile column");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to update user profile",
        )
    })?;

    let mut profile = match profile_value.0 {
        Value::Object(map) => map,
        Value::Null => Map::new(),
        other => {
            warn!(
                ?other,
                "unexpected non-object profile payload; resetting to empty object"
            );
            Map::new()
        }
    };

    ensure_profile_defaults(&mut profile);

    Ok(profile)
}

fn build_user_profile_response(row: Row) -> Result<UserProfileResponse, tokio_postgres::Error> {
    let id: Uuid = row.try_get("id")?;
    let email: String = row.try_get("email")?;
    let display_name: Option<String> = row.try_get("display_name")?;
    let is_guest: bool = row.try_get("is_guest")?;
    let profile_value: PgJson<Value> = row.try_get("profile")?;

    let mut profile = match profile_value.0 {
        Value::Object(map) => map,
        Value::Null => Map::new(),
        other => {
            warn!(
                ?other,
                "unexpected non-object profile payload while building response"
            );
            Map::new()
        }
    };

    ensure_profile_defaults(&mut profile);

    Ok(UserProfileResponse {
        id: id.to_string(),
        email,
        display_name,
        is_guest,
        profile,
    })
}

fn ensure_profile_defaults(profile: &mut Map<String, Value>) {
    match profile.entry("terms_accepted".to_string()) {
        Entry::Vacant(entry) => {
            entry.insert(Value::Bool(false));
        }
        Entry::Occupied(mut entry) => {
            if !entry.get().is_boolean() {
                entry.insert(Value::Bool(false));
            }
        }
    }

    match profile.entry("tutorial_completed".to_string()) {
        Entry::Vacant(entry) => {
            entry.insert(Value::Bool(false));
        }
        Entry::Occupied(mut entry) => {
            if !entry.get().is_boolean() {
                entry.insert(Value::Bool(false));
            }
        }
    }

    match profile.entry("tutorial_progress".to_string()) {
        Entry::Vacant(entry) => {
            entry.insert(Value::Object(Map::new()));
        }
        Entry::Occupied(mut entry) => {
            if !entry.get().is_object() {
                entry.insert(Value::Object(Map::new()));
            }
        }
    }
}
