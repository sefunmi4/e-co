use std::{env, sync::Arc};

use axum::body::{self, Body};
use axum::extract::{Path, Query};
use axum::http::{Request as HttpRequest, StatusCode};
use axum::response::IntoResponse;
use axum::{Extension, Router};
use deadpool_postgres::Config as PgConfig;
use ethos_gateway::auth;
use ethos_gateway::config::GatewayConfig;
use ethos_gateway::grpc::ConversationsGrpc;
use ethos_gateway::matrix::NullMatrixBridge;
use ethos_gateway::migrations::run_migrations;
use ethos_gateway::proto::ethos::v1::{
    conversations_service_server::ConversationsService, PresenceEvent, SendMessageRequest,
    StreamMessagesRequest,
};
use ethos_gateway::router;
use ethos_gateway::routes::{stream_conversation, StreamQuery};
use ethos_gateway::services::{
    EventPublisher, InMemoryGuildService, InMemoryQuestService, InMemoryRoomService, RoomService,
    TestPublisher,
};
use ethos_gateway::state::AppState;
use futures::StreamExt;
use http_body_util::BodyExt;
use serde_json::json;
use std::collections::HashMap;
use tokio::time::Duration;
use tokio_postgres::NoTls;
use tonic::Request as GrpcRequest;
use tower::ServiceExt;
use uuid::Uuid;

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
        is_guest: false,
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
    let quest_service = Arc::new(InMemoryQuestService::new());
    let guild_service = Arc::new(InMemoryGuildService::new());
    let test_publisher = Arc::new(TestPublisher::default());
    let matrix = Arc::new(NullMatrixBridge);
    let publisher: Arc<dyn EventPublisher> = test_publisher.clone();
    let app_state = AppState::new(
        config.clone(),
        db,
        room_service.clone(),
        publisher,
        matrix,
        quest_service,
        guild_service,
    );
    (config, app_state, room_service, test_publisher)
}

async fn register_user(app: &Router, email: &str, password: &str) -> serde_json::Value {
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "email": email,
                        "password": password,
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

async fn login(app: &Router, email: &str, password: &str) -> serde_json::Value {
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "email": email,
                        "password": password,
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

#[tokio::test]
async fn rest_conversation_flow() {
    let (_config, app_state, room_service, _publisher) = build_state().await;
    let app = router(app_state.clone());

    let email = format!("user+{}@example.com", Uuid::new_v4());
    let register_session = register_user(&app, &email, "password").await;
    let session = login(&app, &email, "password").await;
    let token = session["token"].as_str().unwrap();
    let user_id = register_session["user"]["id"].as_str().unwrap();
    assert!(!register_session["user"]["is_guest"].as_bool().unwrap());

    let create_body = json!({
        "participant_user_ids": [user_id],
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

    let conversations = room_service.list_conversations(user_id).await.unwrap();
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
async fn rest_conversation_requires_participation() {
    let (_config, app_state, room_service, _publisher) = build_state().await;
    let app = router(app_state.clone());

    let email_owner = format!("user+{}@example.com", Uuid::new_v4());
    let register_owner = register_user(&app, &email_owner, "password").await;
    let owner_session = login(&app, &email_owner, "password").await;
    let owner_token = owner_session["token"].as_str().unwrap();
    let owner_id = register_owner["user"]["id"].as_str().unwrap();

    let create_body = json!({
        "participant_user_ids": [owner_id],
        "topic": "Restricted Room"
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/conversations")
                .header("authorization", format!("Bearer {owner_token}"))
                .header("content-type", "application/json")
                .body(Body::from(create_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let conversations = room_service.list_conversations(owner_id).await.unwrap();
    assert_eq!(conversations.len(), 1);
    let conversation_id = conversations[0].id.clone();

    let email_stranger = format!("stranger+{}@example.com", Uuid::new_v4());
    register_user(&app, &email_stranger, "password").await;
    let stranger_session = login(&app, &email_stranger, "password").await;
    let stranger_token = stranger_session["token"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!(
                    "/api/conversations/{}/messages",
                    conversation_id
                ))
                .header("authorization", format!("Bearer {stranger_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    let response = app
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!(
                    "/api/conversations/{}/messages",
                    Uuid::new_v4()
                ))
                .header("authorization", format!("Bearer {owner_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test(start_paused = true)]
async fn stream_conversation_emits_presence_snapshots() {
    let config = make_config();
    let mut pg_config = PgConfig::new();
    pg_config.host = Some("localhost".into());
    pg_config.user = Some("tester".into());
    pg_config.dbname = Some("ethos".into());
    let db = pg_config
        .create_pool(Some(deadpool_postgres::Runtime::Tokio1), NoTls)
        .expect("failed to create postgres pool");
    let room_service = Arc::new(InMemoryRoomService::new());
    let quest_service = Arc::new(InMemoryQuestService::new());
    let guild_service = Arc::new(InMemoryGuildService::new());
    let test_publisher = Arc::new(TestPublisher::default());
    let matrix = Arc::new(NullMatrixBridge);
    let publisher: Arc<dyn EventPublisher> = test_publisher.clone();
    let app_state = AppState::new(
        config.clone(),
        db,
        room_service.clone(),
        publisher,
        matrix,
        quest_service,
        guild_service,
    );
    let state = Arc::new(app_state);

    let user_id = "user-1".to_string();
    let conversation = room_service
        .create_conversation(vec![user_id.clone()], Some("Test Room".into()))
        .await
        .unwrap();

    let initial_presence = PresenceEvent {
        user_id: user_id.clone(),
        state: 2,
        updated_at: 1,
    };
    room_service
        .update_presence(initial_presence)
        .await
        .unwrap();

    let token = sign_token(&config, &user_id, "user@example.com");
    let response = stream_conversation(
        Query(StreamQuery { token }),
        Path(conversation.id.clone()),
        Extension(state),
    )
    .await
    .unwrap()
    .into_response();

    let mut body = response.into_body();

    let first_payload = next_presence_payload(&mut body).await;
    assert_eq!(first_payload["type"], "presence");
    let initial_snapshot = serde_json::to_value(room_service.presence_snapshot().await).unwrap();
    assert_eq!(first_payload["presence"], initial_snapshot);

    let updated_presence = PresenceEvent {
        user_id: user_id.clone(),
        state: 4,
        updated_at: 2,
    };
    let updated_presence_json = serde_json::to_value(updated_presence.clone()).unwrap();
    room_service
        .update_presence(updated_presence)
        .await
        .unwrap();
    tokio::task::yield_now().await;

    let realtime_payload = next_presence_payload(&mut body).await;
    assert_eq!(realtime_payload["type"], "presence");
    assert_eq!(realtime_payload["presence"], updated_presence_json);

    tokio::time::advance(Duration::from_secs(10)).await;
    tokio::task::yield_now().await;

    let periodic_payload = next_presence_payload(&mut body).await;
    assert_eq!(periodic_payload["type"], "presence");
    let refreshed_snapshot = serde_json::to_value(room_service.presence_snapshot().await).unwrap();
    assert_eq!(periodic_payload["presence"], refreshed_snapshot);
}

async fn next_presence_payload(body: &mut Body) -> serde_json::Value {
    loop {
        let frame = body
            .frame()
            .await
            .expect("SSE stream should continue")
            .expect("frame should decode");
        let data = match frame.into_data() {
            Ok(data) => data,
            Err(_) => continue,
        };
        let fields = parse_sse_fields(data.as_ref());
        if fields.get("event").map(String::as_str) != Some("presence") {
            continue;
        }
        if let Some(payload) = fields.get("data") {
            break serde_json::from_str(payload).expect("presence payload to be valid JSON");
        }
    }
}

fn parse_sse_fields(bytes: &[u8]) -> HashMap<String, String> {
    let mut fields = HashMap::new();
    for raw_line in bytes.split(|b| *b == b'\n') {
        if raw_line.is_empty() {
            continue;
        }
        let line = raw_line.strip_suffix(&[b'\r']).unwrap_or(raw_line);
        if line.is_empty() {
            continue;
        }
        if line[0] == b':' {
            fields.insert(
                "comment".to_string(),
                String::from_utf8_lossy(&line[1..]).trim().to_string(),
            );
            continue;
        }
        let mut parts = line.splitn(2, |b| *b == b':');
        let key = parts.next().unwrap();
        let value = parts.next().unwrap_or(&[]);
        let key = String::from_utf8_lossy(key).to_string();
        let value = String::from_utf8_lossy(value).trim_start().to_string();
        if !key.is_empty() {
            fields.insert(key, value);
        }
    }
    fields
}

#[tokio::test]
async fn rest_guilds_and_quests_endpoints() {
    let (_config, app_state, _room_service, _publisher) = build_state().await;
    let app = router(app_state.clone());

    let quests_response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri("/api/quests")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(quests_response.status(), StatusCode::OK);
    let quests_body = body::to_bytes(quests_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let quests: serde_json::Value = serde_json::from_slice(&quests_body).unwrap();
    let quests_array = quests
        .as_array()
        .expect("quests response should be an array");
    assert!(!quests_array.is_empty());
    assert!(quests_array[0].get("id").is_some());
    assert!(quests_array[0].get("title").is_some());

    let guilds_response = app
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri("/api/guilds")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(guilds_response.status(), StatusCode::OK);
    let guilds_body = body::to_bytes(guilds_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let guilds: serde_json::Value = serde_json::from_slice(&guilds_body).unwrap();
    let guilds_array = guilds
        .as_array()
        .expect("guilds response should be an array");
    assert!(!guilds_array.is_empty());
    assert!(guilds_array[0].get("id").is_some());
    assert!(guilds_array[0].get("name").is_some());
}

#[tokio::test]
async fn rest_pod_crud_and_publish_endpoints() {
    let (_config, app_state, _room_service, _publisher) = build_state().await;
    let app = router(app_state.clone());

    let email = format!("pod-user+{}@example.com", Uuid::new_v4());
    let session = register_user(&app, &email, "password").await;
    let token = session["token"].as_str().unwrap();

    let create_pod = json!({
        "title": "Launch Pod",
        "description": "Alpha iteration",
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/pods")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(create_pod.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let pod: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let pod_id = pod["id"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri("/api/pods")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let pods_body = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let pods: serde_json::Value = serde_json::from_slice(&pods_body).unwrap();
    assert!(!pods.as_array().unwrap().is_empty());

    let update_pod = json!({ "title": "Launch Pod v2" });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("PUT")
                .uri(format!("/api/pods/{pod_id}"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(update_pod.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let create_item = json!({
        "item_type": "note",
        "item_data": { "text": "First entry" },
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri(format!("/api/pods/{pod_id}/items"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(create_item.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let item: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let item_id = item["id"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/pods/{pod_id}/items"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let items_body = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let items: serde_json::Value = serde_json::from_slice(&items_body).unwrap();
    assert_eq!(items.as_array().unwrap().len(), 1);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("PUT")
                .uri(format!("/api/pods/{pod_id}/items/{item_id}"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(json!({"position": 2}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri(format!("/api/pods/{pod_id}/publish"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let snapshot: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(snapshot["pod"]["id"].as_str().unwrap(), pod_id);
    assert_eq!(snapshot["items"][0]["position"].as_i64().unwrap(), 2);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri("/api/public/pods")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let public_body = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let public: serde_json::Value = serde_json::from_slice(&public_body).unwrap();
    assert!(!public.as_array().unwrap().is_empty());

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("DELETE")
                .uri(format!("/api/pods/{pod_id}/items/{item_id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("DELETE")
                .uri(format!("/api/pods/{pod_id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/pods/{pod_id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let response = app
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/pods/{pod_id}/items/{item_id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn rest_pod_items_auto_positioning() {
    let (_config, app_state, _room_service, _publisher) = build_state().await;
    let app = router(app_state.clone());

    let email = format!("pod-item-auto+{}@example.com", Uuid::new_v4());
    let session = register_user(&app, &email, "password").await;
    let token = session["token"].as_str().unwrap();

    let create_pod = json!({
        "title": "Auto Position Pod",
        "description": "Testing auto positions",
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/pods")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(create_pod.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let pod: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let pod_id = pod["id"].as_str().unwrap();

    let first_item_body = json!({
        "item_type": "note",
        "item_data": { "text": "First" },
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri(format!("/api/pods/{pod_id}/items"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(first_item_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let first_item: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(first_item["position"].as_i64().unwrap(), 0);

    let second_item_body = json!({
        "item_type": "note",
        "item_data": { "text": "Second" },
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri(format!("/api/pods/{pod_id}/items"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(second_item_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let second_item: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(second_item["position"].as_i64().unwrap(), 1);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/pods/{pod_id}/items"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let items: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let items = items.as_array().unwrap();
    assert_eq!(items.len(), 2);
    assert_eq!(items[0]["position"].as_i64().unwrap(), 0);
    assert_eq!(items[1]["position"].as_i64().unwrap(), 1);
}

#[tokio::test]
async fn rest_artifacts_and_orders_endpoints() {
    let (_config, app_state, _room_service, _publisher) = build_state().await;
    let app = router(app_state.clone());

    let email = format!("commerce-user+{}@example.com", Uuid::new_v4());
    let session = register_user(&app, &email, "password").await;
    let token = session["token"].as_str().unwrap();

    let create_artifact = json!({
        "artifact_type": "document",
        "metadata": { "title": "Spec" },
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/artifacts")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(create_artifact.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let artifact: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let artifact_id = artifact["id"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri("/api/artifacts")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/artifacts/{artifact_id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let bad_update = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("PUT")
                .uri(format!("/api/artifacts/{artifact_id}"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(json!({"artifact_type": ""}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(bad_update.status(), StatusCode::BAD_REQUEST);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("PUT")
                .uri(format!("/api/artifacts/{artifact_id}"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({"metadata": {"title": "Updated"}}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri("/api/artifacts?artifact_type=document")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("DELETE")
                .uri(format!("/api/artifacts/{artifact_id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/artifacts/{artifact_id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let order_body = json!({
        "status": "pending",
        "total_cents": 1500,
        "metadata": { "sku": "sku-1" },
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/orders")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(order_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let order: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let order_id = order["id"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri("/api/orders")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/orders/{order_id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let bad_update = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("PUT")
                .uri(format!("/api/orders/{order_id}"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(json!({"status": ""}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(bad_update.status(), StatusCode::BAD_REQUEST);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("PUT")
                .uri(format!("/api/orders/{order_id}"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "status": "fulfilled",
                        "total_cents": 1800,
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("DELETE")
                .uri(format!("/api/orders/{order_id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let response = app
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/orders/{order_id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn guest_login_provisions_account() {
    let (_config, app_state, _room_service, _publisher) = build_state().await;
    let app = router(app_state.clone());

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/auth/guest")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "display_name": "Spectator" }).to_string(),
                ))
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
    assert!(session["user"]["email"]
        .as_str()
        .unwrap()
        .starts_with("guest+"));
    assert_eq!(
        session["user"]["display_name"].as_str().unwrap(),
        "Spectator"
    );
    assert!(session["user"]["is_guest"].as_bool().unwrap());

    let response = app
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/auth/logout")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
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
