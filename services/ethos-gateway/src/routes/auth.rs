use std::sync::Arc;

use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
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

pub async fn login(
    Extension(state): Extension<Arc<AppState>>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<SessionResponse>, impl IntoResponse> {
    if request.email.is_empty() || request.password.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Missing credentials"));
    }

    // For now accept any password and mint a signed JWT. In production integrate with a user directory.
    let user_id = Uuid::new_v5(&Uuid::NAMESPACE_OID, request.email.as_bytes()).to_string();
    let claims = auth::Claims {
        sub: user_id.clone(),
        email: request.email.clone(),
        display_name: Some(request.email.clone()),
        exp: (chrono::Utc::now() + chrono::Duration::hours(12)).timestamp() as usize,
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to sign token"))?;

    Ok(Json(SessionResponse {
        token,
        matrix_access_token: request.matrix_access_token.or_else(|| {
            state
                .config
                .matrix
                .as_ref()
                .and_then(|cfg| cfg.access_token.clone())
        }),
        matrix_homeserver: state
            .config
            .matrix
            .as_ref()
            .map(|cfg| cfg.homeserver.clone()),
        user: SessionUser {
            id: user_id,
            email: request.email,
            display_name: Some("Ethos Operative".into()),
        },
    }))
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
