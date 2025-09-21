use std::sync::Arc;

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    #[serde(default)]
    pub display_name: Option<String>,
    pub exp: usize,
}

#[derive(Debug, Clone)]
pub struct AuthSession {
    pub user_id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub token: String,
}

#[derive(Debug)]
pub struct AuthError;

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        (StatusCode::UNAUTHORIZED, "Unauthorized").into_response()
    }
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthSession
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let state = parts
            .extensions
            .get::<Arc<AppState>>()
            .cloned()
            .ok_or(AuthError)?;
        let auth_header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .ok_or(AuthError)?;
        let token = auth_header
            .strip_prefix("Bearer ")
            .map(str::to_string)
            .ok_or(AuthError)?;

        let claims = decode_token(&state.config.jwt_secret, &token)?;
        Ok(AuthSession {
            user_id: claims.sub,
            email: claims.email,
            display_name: claims.display_name,
            token,
        })
    }
}

pub fn decode_token(secret: &str, token: &str) -> Result<Claims, AuthError> {
    let validation = Validation::new(Algorithm::HS256);
    let decoded = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|_| AuthError)?;
    Ok(decoded.claims)
}
