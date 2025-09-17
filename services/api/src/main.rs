mod search;

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::{routing::get, Json, Router};
use search::{SearchError, SearchIndex, WorldCard};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use thiserror::Error;
use tokio::net::TcpListener;
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;

#[derive(Clone)]
struct AppState {
    search: Arc<SearchIndex>,
}

#[derive(Debug, Error)]
enum ApiError {
    #[error("search initialisation failed: {0}")]
    Search(#[from] SearchError),
    #[error("invalid listen address: {0}")]
    Addr(#[from] std::net::AddrParseError),
    #[error("failed to bind listener: {0}")]
    Io(#[from] std::io::Error),
    #[error("server error: {0}")]
    Server(#[from] hyper::Error),
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
}

#[tokio::main]
async fn main() -> Result<(), ApiError> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let search = SearchIndex::bootstrap_from_examples()?;
    let state = AppState {
        search: Arc::new(search),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/query", get(query))
        .with_state(state);

    let addr: SocketAddr = std::env::var("ECO_API_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:8080".to_string())
        .parse()?;
    let listener = TcpListener::bind(addr).await?;
    info!(%addr, "eco-api listening");
    axum::serve(listener, app.into_make_service()).await?;
    Ok(())
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

#[derive(Debug, Serialize, Deserialize)]
struct QueryResponse {
    results: Vec<WorldCard>,
}

#[derive(Debug, Deserialize)]
struct QueryParams {
    q: String,
    limit: Option<usize>,
}

async fn query(
    State(state): State<AppState>,
    Query(params): Query<QueryParams>,
) -> Result<Json<QueryResponse>, (StatusCode, String)> {
    let limit = params.limit.unwrap_or(5).clamp(1, 25);
    match state.search.search(&params.q, limit) {
        Ok(results) => Ok(Json(QueryResponse { results })),
        Err(err) => {
            let status = err.status_code();
            warn!(?err, "search query failed");
            Err((status, err.to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;
    use axum::body::Body;
    use axum::http::Request;
    use tower::util::ServiceExt;

    #[tokio::test]
    async fn health_route() {
        let Json(resp) = health().await;
        assert_eq!(resp.status, "ok");
    }

    #[tokio::test]
    async fn query_route_returns_results() {
        let state = AppState {
            search: Arc::new(SearchIndex::bootstrap_from_examples().expect("bootstrap")),
        };
        let app = Router::new().route("/query", get(query)).with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/query?q=Aurora")
                    .body(Body::empty())
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_eq!(response.status(), StatusCode::OK);
        let bytes = to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("body bytes");
        let payload: QueryResponse = serde_json::from_slice(&bytes).expect("deserialize response");
        assert!(!payload.results.is_empty());
    }
}
