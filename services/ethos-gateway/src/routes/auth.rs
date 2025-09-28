use std::sync::Arc;

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use tokio_postgres::{error::SqlState, Row};
use tracing::error;
use uuid::Uuid;

use crate::{
    auth::{self, AuthSession},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub matrix_access_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub display_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matrix_access_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matrix_homeserver: Option<String>,
    pub user: SessionUser,
}

#[derive(Debug, Serialize)]
pub struct SessionUser {
    pub id: String,
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
}

struct DbUser {
    id: Uuid,
    email: String,
    password_hash: String,
    display_name: Option<String>,
}

impl DbUser {
    fn from_row(row: &Row) -> Result<Self, tokio_postgres::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            email: row.try_get("email")?,
            password_hash: row.try_get("password_hash")?,
            display_name: row.try_get("display_name")?,
        })
    }
}

pub async fn login(
    Extension(state): Extension<Arc<AppState>>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<SessionResponse>, impl IntoResponse> {
    let LoginRequest {
        email,
        password,
        matrix_access_token,
    } = request;

    if email.is_empty() || password.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Missing credentials"));
    }

    let client = state.db.get().await.map_err(|error| {
        error!(error = ?error, "failed to acquire database connection");
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to authenticate")
    })?;

    let row = client
        .query_opt(
            "SELECT id, email, password_hash, display_name FROM users WHERE email = $1",
            &[&email],
        )
        .await
        .map_err(|error| {
            error!(error = ?error, "failed to fetch user during login");
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to authenticate")
        })?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid credentials"))?;
    let user = DbUser::from_row(&row).map_err(|error| {
        error!(error = ?error, "failed to parse user record");
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to authenticate")
    })?;

    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to authenticate"))?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid credentials"))?;

    let response = build_session_response(state.as_ref(), &user, matrix_access_token)?;

    Ok(Json(response))
}

pub async fn register(
    Extension(state): Extension<Arc<AppState>>,
    Json(request): Json<RegisterRequest>,
) -> Result<Json<SessionResponse>, impl IntoResponse> {
    let RegisterRequest {
        email,
        password,
        display_name,
    } = request;

    if email.is_empty() || password.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Missing credentials"));
    }

    let mut rng = OsRng;
    let password_hash = Argon2::default()
        .hash_password(password.as_bytes(), &SaltString::generate(&mut rng))
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to register user"))?
        .to_string();

    let normalized_display_name = display_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);

    let client = state.db.get().await.map_err(|error| {
        error!(error = ?error, "failed to acquire database connection");
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to register user")
    })?;

    let user_id = Uuid::new_v4();
    let display_name_param: Option<&str> = normalized_display_name.as_deref();
    let row = client
        .query_one(
            "INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4) \
             RETURNING id, email, password_hash, display_name",
            &[&user_id, &email, &password_hash, &display_name_param],
        )
        .await
        .map_err(|error| {
            if let Some(code) = error.code() {
                if code == &SqlState::UNIQUE_VIOLATION {
                    return (StatusCode::CONFLICT, "Email already registered");
                }
                if matches!(
                    code,
                    &SqlState::UNDEFINED_TABLE
                        | &SqlState::UNDEFINED_COLUMN
                        | &SqlState::INVALID_SCHEMA_NAME
                ) {
                    error!(
                        error = ?error,
                        "failed to register user because database schema is unavailable"
                    );
                    return (
                        StatusCode::SERVICE_UNAVAILABLE,
                        "Registration temporarily unavailable while the service initializes",
                    );
                }
            }
            error!(error = ?error, "failed to register user");
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to register user")
        })?;
    let user = DbUser::from_row(&row).map_err(|error| {
        error!(error = ?error, "failed to parse user record");
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to register user")
    })?;

    let response = build_session_response(state.as_ref(), &user, None)?;

    Ok(Json(response))
}

pub async fn session(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
) -> Json<SessionResponse> {
    Json(SessionResponse {
        token: auth.token,
        matrix_access_token: state
            .config
            .matrix
            .as_ref()
            .and_then(|cfg| cfg.access_token.clone()),
        matrix_homeserver: state
            .config
            .matrix
            .as_ref()
            .map(|cfg| cfg.homeserver.clone()),
        user: SessionUser {
            id: auth.user_id,
            email: auth.email,
            display_name: auth.display_name,
        },
    })
}

fn build_session_response(
    state: &AppState,
    user: &DbUser,
    matrix_override: Option<String>,
) -> Result<SessionResponse, (StatusCode, &'static str)> {
    let claims = auth::Claims {
        sub: user.id.to_string(),
        email: user.email.clone(),
        display_name: user.display_name.clone(),
        exp: (Utc::now() + Duration::hours(12)).timestamp() as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to sign token"))?;

    let matrix_access_token = matrix_override.or_else(|| {
        state
            .config
            .matrix
            .as_ref()
            .and_then(|cfg| cfg.access_token.clone())
    });
    let matrix_homeserver = state
        .config
        .matrix
        .as_ref()
        .map(|cfg| cfg.homeserver.clone());

    Ok(SessionResponse {
        token,
        matrix_access_token,
        matrix_homeserver,
        user: SessionUser {
            id: user.id.to_string(),
            email: user.email.clone(),
            display_name: user.display_name.clone(),
        },
    })
}
