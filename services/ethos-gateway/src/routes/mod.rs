use std::sync::Arc;

use axum::{
    http::{header, Method},
    routing::{get, post},
    Extension, Router,
};
use tower_http::cors::{Any, CorsLayer};

use crate::state::AppState;

mod artifacts;
mod auth;
mod conversations;
mod guilds;
mod orders;
mod pod_items;
mod pods;
mod quests;
mod stream;
mod users;

pub use artifacts::*;
pub use auth::*;
pub use conversations::*;
pub use guilds::*;
pub use orders::*;
pub use pod_items::*;
pub use pods::*;
pub use quests::*;
pub use stream::*;
pub use users::*;

pub fn router(state: AppState) -> Router {
    let shared = Arc::new(state);
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
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
        .route("/api/pods", get(list_pods).post(create_pod))
        .route(
            "/api/pods/:id",
            get(get_pod).put(update_pod).delete(delete_pod),
        )
        .route("/api/pods/:id/publish", post(publish_pod))
        .route(
            "/api/pods/:pod_id/items",
            get(list_pod_items).post(create_pod_item),
        )
        .route(
            "/api/pods/:pod_id/items/:item_id",
            get(get_pod_item)
                .put(update_pod_item)
                .delete(delete_pod_item),
        )
        .route("/api/public/pods", get(list_public_pods))
        .route("/api/artifacts", get(list_artifacts).post(create_artifact))
        .route(
            "/api/artifacts/:id",
            get(get_artifact)
                .put(update_artifact)
                .delete(delete_artifact),
        )
        .route("/api/orders", get(list_orders).post(create_order))
        .route(
            "/api/orders/:id",
            get(get_order).put(update_order).delete(delete_order),
        )
        .route("/api/users/me", get(me).put(update_me))
        .layer(cors)
        .layer(Extension(shared.clone()))
        .with_state(shared)
}
