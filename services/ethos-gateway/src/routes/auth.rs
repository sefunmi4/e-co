use std::sync::Arc;

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
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

#[derive(Debug, Deserialize)]
pub struct GuestLoginRequest {
    #[serde(default)]
    pub display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub session_id: String,
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_expires_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matrix_access_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matrix_homeserver: Option<String>,
    pub user: SessionUser,
}

struct RefreshTokenBundle {
    refresh_token: String,
    session_id: Uuid,
    expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct SessionUser {
    pub id: String,
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    pub is_guest: bool,
}

struct DbUser {
    id: Uuid,
    email: String,
    password_hash: String,
    display_name: Option<String>,
    is_guest: bool,
}

impl DbUser {
    fn from_row(row: &Row) -> Result<Self, tokio_postgres::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            email: row.try_get("email")?,
            password_hash: row.try_get("password_hash")?,
            display_name: row.try_get("display_name")?,
            is_guest: row.try_get("is_guest")?,
        })
    }
}

pub async fn login(
    Extension(state): Extension<Arc<AppState>>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<SessionResponse>, (StatusCode, &'static str)> {
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
            "SELECT id, email, password_hash, display_name, is_guest FROM users WHERE email = $1",
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

    let refresh = create_refresh_session(&*client, user.id)
        .await
        .map_err(|error| {
            error!(error = ?error, "failed to create refresh session during login");
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to authenticate")
        })?;

    let response =
        build_session_response(state.as_ref(), &user, matrix_access_token, Some(refresh))?;

    Ok(Json(response))
}

pub async fn register(
    Extension(state): Extension<Arc<AppState>>,
    Json(request): Json<RegisterRequest>,
) -> Result<Json<SessionResponse>, (StatusCode, &'static str)> {
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
            "INSERT INTO users (id, email, password_hash, display_name, is_guest) VALUES ($1, $2, $3, $4, FALSE) \
             RETURNING id, email, password_hash, display_name, is_guest",
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

    let refresh = create_refresh_session(&*client, user.id)
        .await
        .map_err(|error| {
            error!(
                error = ?error,
                "failed to create refresh session during registration"
            );
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to register user")
        })?;

    let response = build_session_response(state.as_ref(), &user, None, Some(refresh))?;

    Ok(Json(response))
}

pub async fn guest_login(
    Extension(state): Extension<Arc<AppState>>,
    Json(request): Json<GuestLoginRequest>,
) -> Result<Json<SessionResponse>, (StatusCode, &'static str)> {
    let mut rng = OsRng;
    let password = Uuid::new_v4().to_string();
    let password_hash = Argon2::default()
        .hash_password(password.as_bytes(), &SaltString::generate(&mut rng))
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to authenticate guest",
            )
        })?
        .to_string();

    let user_id = Uuid::new_v4();
    let slug = user_id.simple().to_string();
    let fallback_display = format!("Guest {}", &slug[..8]);
    let display_name = request
        .display_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .unwrap_or(fallback_display);
    let email = format!("guest+{}@ethos.local", slug);

    let client = state.db.get().await.map_err(|error| {
        error!(error = ?error, "failed to acquire database connection for guest login");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to authenticate guest",
        )
    })?;

    let row = client
        .query_one(
            "INSERT INTO users (id, email, password_hash, display_name, is_guest) VALUES ($1, $2, $3, $4, TRUE) \
             RETURNING id, email, password_hash, display_name, is_guest",
            &[&user_id, &email, &password_hash, &display_name],
        )
        .await
        .map_err(|error| {
            error!(error = ?error, "failed to create guest user");
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to authenticate guest")
        })?;
    let user = DbUser::from_row(&row).map_err(|error| {
        error!(error = ?error, "failed to parse guest user record");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to authenticate guest",
        )
    })?;

    let refresh = create_refresh_session(&*client, user.id)
        .await
        .map_err(|error| {
            error!(
                error = ?error,
                "failed to create refresh session during guest login"
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to authenticate guest",
            )
        })?;

    let response = build_session_response(state.as_ref(), &user, None, Some(refresh))?;

    Ok(Json(response))
}

pub async fn refresh(
    Extension(state): Extension<Arc<AppState>>,
    Json(request): Json<RefreshRequest>,
) -> Result<Json<SessionResponse>, (StatusCode, &'static str)> {
    let RefreshRequest {
        session_id,
        refresh_token,
    } = request;

    if refresh_token.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Missing refresh token"));
    }

    let session_id = Uuid::parse_str(session_id.trim())
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid session id"))?;

    let client = state.db.get().await.map_err(|error| {
        error!(error = ?error, "failed to acquire database connection for refresh");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to refresh session",
        )
    })?;

    let provided_hash = hash_refresh_token(&refresh_token);
    let new_refresh_token = generate_refresh_token();
    let new_hash = hash_refresh_token(&new_refresh_token);
    let expires_at = refresh_expiration();

    let row = client
        .query_opt(
            "UPDATE refresh_sessions \
             SET refresh_token_hash = $1, expires_at = $2, updated_at = NOW() \
             WHERE session_id = $3 AND refresh_token_hash = $4 \
                 AND revoked_at IS NULL AND expires_at > NOW() \
             RETURNING user_id",
            &[&new_hash, &expires_at, &session_id, &provided_hash],
        )
        .await
        .map_err(|error| {
            error!(error = ?error, "failed to rotate refresh session");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to refresh session",
            )
        })?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid refresh token"))?;

    let user_id: Uuid = row.try_get("user_id").map_err(|error| {
        error!(
            error = ?error,
            "failed to decode user id while rotating refresh session"
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to refresh session",
        )
    })?;

    let user_row = client
        .query_opt(
            "SELECT id, email, password_hash, display_name, is_guest FROM users WHERE id = $1",
            &[&user_id],
        )
        .await
        .map_err(|error| {
            error!(
                error = ?error,
                "failed to fetch user while generating refreshed session"
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to refresh session",
            )
        })?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid refresh token"))?;

    let user = DbUser::from_row(&user_row).map_err(|error| {
        error!(error = ?error, "failed to parse user record during refresh");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to refresh session",
        )
    })?;

    let refresh_bundle = RefreshTokenBundle {
        refresh_token: new_refresh_token,
        session_id,
        expires_at,
    };

    let response = build_session_response(state.as_ref(), &user, None, Some(refresh_bundle))?;

    Ok(Json(response))
}

pub async fn session(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
) -> Json<SessionResponse> {
    Json(SessionResponse {
        token: auth.token,
        refresh_token: None,
        refresh_session_id: None,
        refresh_expires_at: None,
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
            is_guest: auth.is_guest,
        },
    })
}

pub async fn logout() -> impl IntoResponse {
    StatusCode::NO_CONTENT
}

fn build_session_response(
    state: &AppState,
    user: &DbUser,
    matrix_override: Option<String>,
    refresh: Option<RefreshTokenBundle>,
) -> Result<SessionResponse, (StatusCode, &'static str)> {
    let claims = auth::Claims {
        sub: user.id.to_string(),
        email: user.email.clone(),
        display_name: user.display_name.clone(),
        is_guest: user.is_guest,
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
        refresh_token: refresh.as_ref().map(|bundle| bundle.refresh_token.clone()),
        refresh_session_id: refresh.as_ref().map(|bundle| bundle.session_id.to_string()),
        refresh_expires_at: refresh.as_ref().map(|bundle| bundle.expires_at),
        matrix_access_token,
        matrix_homeserver,
        user: SessionUser {
            id: user.id.to_string(),
            email: user.email.clone(),
            display_name: user.display_name.clone(),
            is_guest: user.is_guest,
        },
    })
}

async fn create_refresh_session(
    client: &tokio_postgres::Client,
    user_id: Uuid,
) -> Result<RefreshTokenBundle, tokio_postgres::Error> {
    let session_id = Uuid::new_v4();
    let refresh_token = generate_refresh_token();
    let refresh_token_hash = hash_refresh_token(&refresh_token);
    let expires_at = refresh_expiration();
    let id = Uuid::new_v4();

    client
        .execute(
            "INSERT INTO refresh_sessions (id, user_id, session_id, refresh_token_hash, expires_at) \
             VALUES ($1, $2, $3, $4, $5)",
            &[&id, &user_id, &session_id, &refresh_token_hash, &expires_at],
        )
        .await?;

    Ok(RefreshTokenBundle {
        refresh_token,
        session_id,
        expires_at,
    })
}

fn generate_refresh_token() -> String {
    format!("{}{}", Uuid::new_v4(), Uuid::new_v4())
}

fn hash_refresh_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

fn refresh_expiration() -> DateTime<Utc> {
    Utc::now() + Duration::days(30)
}
