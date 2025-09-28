use std::{env, sync::Arc};

use axum::body::{self, Body};
use axum::http::{Request as HttpRequest, StatusCode};
use deadpool_postgres::Config as PgConfig;
use ethos_gateway::auth;
use ethos_gateway::config::GatewayConfig;
use ethos_gateway::grpc::ConversationsGrpc;
use ethos_gateway::matrix::NullMatrixBridge;
use ethos_gateway::migrations::run_migrations;
use ethos_gateway::proto::ethos::v1::{
    conversations_service_server::ConversationsService, SendMessageRequest, StreamMessagesRequest,
};
use ethos_gateway::router;
use ethos_gateway::services::{EventPublisher, InMemoryRoomService, RoomService, TestPublisher};
use ethos_gateway::state::AppState;
use futures::StreamExt;
use serde_json::json;
use tokio_postgres::NoTls;
use tonic::Request as GrpcRequest;
use tower::ServiceExt;

fn make_config() -> GatewayConfig {
    GatewayConfig {
        jwt_secret: "test-secret".into(),
        http_addr: "127.0.0.1:0".parse().unwrap(),
        grpc_addr: "127.0.0.1:0".parse().unwrap(),
        nats_url: None,
        database_url: env::var("ETHOS_TEST_DATABASE_URL")
            .or_else(|_| env::var("DATABASE_URL"))
            .unwrap_or_else(|_| "postgres://ethos:ethos@localhost:5432/ethos".into()),
        matrix: None,
    }
}

fn sign_token(config: &GatewayConfig, user_id: &str, email: &str) -> String {
    let claims = auth::Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        display_name: Some("Test".into()),
        exp: (chrono::Utc::now() + chrono::Duration::hours(1)).timestamp() as usize,
    };
    jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .unwrap()
}

async fn build_state() -> (
    GatewayConfig,
    AppState,
    Arc<InMemoryRoomService>,
    Arc<TestPublisher>,
) {
    let config = make_config();
    let mut pg_config = PgConfig::new();
    pg_config.url = Some(config.database_url.clone());
    let db = pg_config
        .create_pool(None, NoTls)
        .expect("failed to create postgres pool for tests");
    run_migrations(&db)
        .await
        .expect("failed to run migrations for tests");
    let room_service = Arc::new(InMemoryRoomService::new());
    let test_publisher = Arc::new(TestPublisher::default());
    let matrix = Arc::new(NullMatrixBridge);
    let publisher: Arc<dyn EventPublisher> = test_publisher.clone();
    let app_state = AppState::new(config.clone(), db, room_service.clone(), publisher, matrix);
    (config, app_state, room_service, test_publisher)
}

#[tokio::test]
async fn rest_conversation_flow() {
    let (_config, app_state, room_service, _publisher) = build_state().await;
    let app = router(app_state.clone());

    let body = json!({
        "email": "user@example.com",
        "password": "password"
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let session: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let token = session["token"].as_str().unwrap();

    let create_body = json!({
        "participant_user_ids": ["user@example.com"],
        "topic": "Test Room"
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/conversations")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(create_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let conversations = room_service
        .list_conversations("user@example.com")
        .await
        .unwrap();
    assert_eq!(conversations.len(), 1);
    let conversation_id = conversations[0].id.clone();

    let message_body = json!({ "body": "Testing" });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri(format!("/api/conversations/{conversation_id}/messages"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(message_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri("/api/conversations")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        payload["conversations"][0]["messages"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn grpc_send_message_publishes_events() {
    let (config, app_state, room_service, test_publisher) = build_state().await;
    let state = Arc::new(app_state);
    let service = ConversationsGrpc::new(state.clone());

    let conversation = room_service
        .create_conversation(vec!["user@example.com".into()], Some("Guild".into()))
        .await
        .unwrap();

    let token = sign_token(&config, "user@example.com", "user@example.com");
    let mut request = GrpcRequest::new(SendMessageRequest {
        conversation_id: conversation.id.clone(),
        body: "Hello from gRPC".into(),
    });
    request
        .metadata_mut()
        .insert("authorization", format!("Bearer {token}").parse().unwrap());
    let response = service.send_message(request).await.unwrap();
    assert!(response.into_inner().message.is_some());

    let events = test_publisher.0.lock().await;
    assert_eq!(events.len(), 1);
    assert!(events[0].0.contains("ethos.chat"));
}

#[tokio::test]
async fn grpc_stream_includes_backlog() {
    let (config, app_state, room_service, _publisher) = build_state().await;
    let state = Arc::new(app_state);
    let service = ConversationsGrpc::new(state.clone());

    let conversation = room_service
        .create_conversation(vec!["user@example.com".into()], Some("Guild".into()))
        .await
        .unwrap();
    room_service
        .append_message(&conversation.id, "user@example.com", "First")
        .await
        .unwrap();

    let token = sign_token(&config, "user@example.com", "user@example.com");
    let mut request = GrpcRequest::new(StreamMessagesRequest {
        conversation_id: conversation.id.clone(),
    });
    request
        .metadata_mut()
        .insert("authorization", format!("Bearer {token}").parse().unwrap());
    let mut stream = service.stream_messages(request).await.unwrap().into_inner();
    let first = stream.next().await.unwrap().unwrap();
    assert_eq!(first.message.unwrap().body, "First");
}
