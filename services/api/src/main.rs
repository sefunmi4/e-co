use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::net::SocketAddr;
use tracing::info;
use tracing_subscriber::EnvFilter;

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let app = Router::new().route("/health", get(health));

    let addr: SocketAddr = "127.0.0.1:8080".parse().expect("valid address");
    info!("eco-api listening", %addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .expect("server to run");
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn health_route() {
        let Json(resp) = health().await;
        assert_eq!(resp.status, "ok");
    }
}
