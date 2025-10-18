mod search;
mod verification;

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::{routing::get, routing::post, Json, Router};
use search::{FacetSummary, SearchError, SearchHit, SearchIndex, SearchRequest};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use thiserror::Error;
use tokio::net::TcpListener;
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;
use verification::{DeliveryChannel, LoggingCodeSender, VerificationConfig, VerificationService};

#[derive(Clone)]
struct AppState {
    search: Arc<SearchIndex>,
    verification: VerificationService,
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

    let index_path = std::env::var("ECO_INDEX_PATH").unwrap_or_default();
    let search = SearchIndex::open(index_path)?;
    let verification_secret =
        std::env::var("ECO_VERIFICATION_SECRET").unwrap_or_else(|_| "local-dev-secret".to_string());
    let verification_sender = Arc::new(LoggingCodeSender::default());
    let verification = VerificationService::new(
        VerificationConfig::default(),
        verification_secret.into_bytes(),
        verification_sender,
    );
    let state = AppState {
        search: Arc::new(search),
        verification,
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/query", get(query))
        .route("/auth/verification-code", post(request_code))
        .route("/auth/verify", post(verify_code))
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
    hits: Vec<SearchHit>,
    facets: FacetSummary,
}

#[derive(Debug, Deserialize)]
struct QueryParams {
    #[serde(default)]
    q: Option<String>,
    #[serde(default)]
    limit: Option<usize>,
    #[serde(rename = "type", default)]
    entity_types: Vec<String>,
    #[serde(default)]
    tag: Vec<String>,
    #[serde(default)]
    visibility: Vec<String>,
}

async fn query(
    State(state): State<AppState>,
    Query(params): Query<QueryParams>,
) -> Result<Json<QueryResponse>, (StatusCode, String)> {
    let QueryParams {
        q,
        limit,
        entity_types,
        tag,
        visibility,
    } = params;
    let query_text = q.unwrap_or_default();
    let limit = limit.unwrap_or(10).clamp(1, 50);
    let request = SearchRequest {
        query: &query_text,
        limit,
        entity_types: entity_types.as_slice(),
        tags: tag.as_slice(),
        visibilities: visibility.as_slice(),
    };
    match state.search.search(request) {
        Ok(results) => Ok(Json(QueryResponse {
            hits: results.hits,
            facets: results.facets,
        })),
        Err(err) => {
            let status = err.status_code();
            warn!(?err, "search query failed");
            Err((status, err.to_string()))
        }
    }
}

#[derive(Debug, Deserialize)]
struct VerificationCodeRequest {
    identifier: String,
    channel: DeliveryChannel,
    #[serde(default = "default_locale")]
    locale: String,
}

#[derive(Debug, Serialize)]
struct VerificationCodeResponse {
    expires_in: u64,
    retry_after: u64,
}

fn default_locale() -> String {
    "en-US".to_string()
}

async fn request_code(
    State(state): State<AppState>,
    Json(payload): Json<VerificationCodeRequest>,
) -> Result<Json<VerificationCodeResponse>, (StatusCode, String)> {
    match state
        .verification
        .issue_code(&payload.identifier, payload.channel, &payload.locale)
        .await
    {
        Ok(outcome) => Ok(Json(VerificationCodeResponse {
            expires_in: outcome.expires_in.as_secs(),
            retry_after: outcome.retry_after.as_secs(),
        })),
        Err(err) => {
            let status = err.status_code();
            Err((status, err.to_string()))
        }
    }
}

#[derive(Debug, Deserialize)]
struct VerifyCodeRequest {
    identifier: String,
    channel: DeliveryChannel,
    code: String,
}

#[derive(Debug, Serialize)]
struct VerifyCodeResponse {
    verified: bool,
    remaining_attempts: u32,
}

async fn verify_code(
    State(state): State<AppState>,
    Json(payload): Json<VerifyCodeRequest>,
) -> Result<Json<VerifyCodeResponse>, (StatusCode, String)> {
    match state
        .verification
        .verify_code(&payload.identifier, payload.channel, &payload.code)
        .await
    {
        Ok(outcome) => Ok(Json(VerifyCodeResponse {
            verified: outcome.verified,
            remaining_attempts: outcome.remaining_attempts,
        })),
        Err(err) => {
            let status = err.status_code();
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
    use tantivy::{
        doc,
        schema::{Facet, STORED, STRING, TEXT},
    };
    use tower::util::ServiceExt;

    #[tokio::test]
    async fn health_route() {
        let Json(resp) = health().await;
        assert_eq!(resp.status, "ok");
    }

    #[tokio::test]
    async fn query_route_returns_results() {
        let search_index = build_test_search_index();
        let state = AppState {
            search: Arc::new(search_index),
            verification: VerificationService::new(
                VerificationConfig::default(),
                b"test-secret".to_vec(),
                Arc::new(LoggingCodeSender::default()),
            ),
        };
        let app = Router::new().route("/query", get(query)).with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/query?q=community")
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
        assert_eq!(payload.hits.len(), 2);
        assert!(!payload.facets.entity_type.is_empty());
    }

    fn build_test_search_index() -> SearchIndex {
        let mut builder = tantivy::schema::Schema::builder();
        let doc_id = builder.add_text_field("doc_id", STRING | STORED);
        let entity_id = builder.add_text_field("entity_id", STRING | STORED);
        let entity_type = builder.add_text_field("entity_type", STRING | STORED);
        let entity_type_facet = builder.add_facet_field(
            "entity_type_facet",
            tantivy::schema::FacetOptions::default().set_stored(),
        );
        let _owner_id = builder.add_text_field("owner_id", STRING | STORED);
        let title = builder.add_text_field("title", TEXT | STORED);
        let description = builder.add_text_field("description", TEXT | STORED);
        let visibility = builder.add_text_field("visibility", STRING | STORED);
        let visibility_facet = builder.add_facet_field(
            "visibility_facet",
            tantivy::schema::FacetOptions::default().set_stored(),
        );
        let tags = builder.add_text_field("tags", TEXT | STORED);
        let tag_facet = builder.add_facet_field(
            "tag_facet",
            tantivy::schema::FacetOptions::default().set_stored(),
        );
        let status = builder.add_text_field("status", STRING | STORED);
        let kind = builder.add_text_field("kind", STRING | STORED);
        let content = builder.add_text_field("content", TEXT);
        let schema = builder.build();
        let index = tantivy::Index::create_in_ram(schema);
        let mut writer = index.writer(50_000_000).expect("writer");
        writer
            .add_document(doc!(
                doc_id => "pod:1",
                entity_id => "1",
                entity_type => "pod",
                entity_type_facet => Facet::from("/type/pod"),
                title => "Community Pod",
                description => "A public pod",
                visibility => "public",
                visibility_facet => Facet::from("/visibility/public"),
                tags => "community",
                tag_facet => Facet::from("/tag/community"),
                status => "published",
                kind => "pod_snapshot",
                content => "community pod",
            ))
            .expect("add pod");
        writer
            .add_document(doc!(
                doc_id => "quest:2",
                entity_id => "2",
                entity_type => "quest",
                entity_type_facet => Facet::from("/type/quest"),
                title => "Community Quest",
                description => "A private challenge",
                visibility => "private",
                visibility_facet => Facet::from("/visibility/private"),
                tags => "private",
                tag_facet => Facet::from("/tag/private"),
                status => "draft",
                kind => "quest",
                content => "community quest",
            ))
            .expect("add quest");
        writer.commit().expect("commit");
        SearchIndex::from_index(index).expect("search index")
    }
}
