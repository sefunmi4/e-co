use std::sync::Arc;

use axum::{
    http::{header, Method},
    routing::{get, post},
    Extension, Router,
};
use tower_http::cors::{Any, CorsLayer};

use crate::state::AppState;

mod auth;
mod conversations;
mod guilds;
mod quests;
mod stream;
mod users;

pub use auth::*;
pub use conversations::*;
pub use guilds::*;
pub use quests::*;
pub use stream::*;
pub use users::*;

pub fn router(state: AppState) -> Router {
    let shared = Arc::new(state);
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    Router::new()
        .route("/auth/login", post(login))
        .route("/auth/register", post(register))
        .route("/auth/guest", post(guest_login))
        .route("/auth/logout", post(logout))
        .route("/auth/session", get(session))
        .route(
            "/api/conversations",
            get(list_conversations).post(create_conversation),
        )
        .route(
            "/api/conversations/:id/messages",
            get(list_messages).post(post_message),
        )
        .route("/api/conversations/:id/stream", get(stream_conversation))
        .route("/api/quests", get(list_quests).post(create_quest))
        .route(
            "/api/quests/:id",
            get(get_quest).put(update_quest).delete(delete_quest),
        )
        .route("/api/guilds", get(list_guilds).post(create_guild))
        .route(
            "/api/guilds/:id",
            get(get_guild).put(update_guild).delete(delete_guild),
        )
        .route("/api/users/me", get(me).put(update_me))
        .layer(cors)
        .layer(Extension(shared.clone()))
        .with_state(shared)
}
