use std::{env, sync::Arc};

use axum::body::{self, Body};
use axum::extract::{Path, Query};
use axum::http::{Request as HttpRequest, StatusCode};
use axum::response::IntoResponse;
use axum::{Extension, Router};
use deadpool_postgres::{Config as PgConfig, Pool};
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
    EventPublisher, GuildService, InMemoryRoomService, PostgresGuildService, PostgresQuestService,
    QuestEvent, QuestService, RoomService, TestPublisher,
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

async fn reset_database(db: &Pool) {
    let client = db
        .get()
        .await
        .expect("failed to acquire connection for test reset");
    client
        .batch_execute(
            "TRUNCATE TABLE order_item_options, order_items, cart_item_options, cart_items, carts, artifact_variant_options, artifact_variants, memberships, quest_applications, quests, guilds, messages, conversations, pod_items, pods, artifacts, orders, refresh_sessions, users RESTART IDENTITY CASCADE;",
        )
        .await
        .expect("failed to reset database for tests");
}

async fn build_state() -> (
    GatewayConfig,
    AppState,
    Arc<InMemoryRoomService>,
    Arc<TestPublisher>,
) {
    let config = make_config();
    let (app_state, room_service, test_publisher) = build_state_with_config(&config, true).await;
    (config, app_state, room_service, test_publisher)
}

async fn build_state_with_config(
    config: &GatewayConfig,
    reset_db: bool,
) -> (AppState, Arc<InMemoryRoomService>, Arc<TestPublisher>) {
    let mut pg_config = PgConfig::new();
    pg_config.url = Some(config.database_url.clone());
    let db = pg_config
        .create_pool(None, NoTls)
        .expect("failed to create postgres pool for tests");
    run_migrations(&db)
        .await
        .expect("failed to run migrations for tests");
    if reset_db {
        reset_database(&db).await;
    }
    let room_service = Arc::new(InMemoryRoomService::new());
    let test_publisher = Arc::new(TestPublisher::default());
    let matrix = Arc::new(NullMatrixBridge);
    let publisher: Arc<dyn EventPublisher> = test_publisher.clone();
    let quest_service: Arc<dyn QuestService> =
        Arc::new(PostgresQuestService::new(db.clone(), publisher.clone()));
    let guild_service: Arc<dyn GuildService> = Arc::new(PostgresGuildService::new(db.clone()));
    let app_state = AppState::new(
        config.clone(),
        db,
        room_service.clone(),
        publisher,
        matrix,
        quest_service,
        guild_service,
    );
    (app_state, room_service, test_publisher)
}

async fn rebuild_state(
    config: &GatewayConfig,
) -> (AppState, Arc<InMemoryRoomService>, Arc<TestPublisher>) {
    build_state_with_config(config, false).await
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

async fn refresh_session(
    app: &Router,
    session_id: &str,
    refresh_token: &str,
) -> (StatusCode, serde_json::Value) {
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/auth/refresh")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "session_id": session_id,
                        "refresh_token": refresh_token,
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let payload = if bytes.is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null)
    };
    (status, payload)
}

async fn make_stream_test_state() -> (GatewayConfig, Arc<AppState>, Arc<InMemoryRoomService>) {
    let config = make_config();
    let (app_state, room_service, _) = build_state_with_config(&config, true).await;
    (config, Arc::new(app_state), room_service)
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
async fn refresh_session_rotates_tokens() {
    let (_config, app_state, _room_service, _publisher) = build_state().await;
    let app = router(app_state.clone());

    let email = format!("user+{}@example.com", Uuid::new_v4());
    register_user(&app, &email, "password").await;
    let session = login(&app, &email, "password").await;

    let original_access_token = session["token"].as_str().unwrap().to_string();
    let refresh_token = session["refresh_token"].as_str().unwrap();
    let session_id = session["refresh_session_id"].as_str().unwrap();

    let (status, refreshed) = refresh_session(&app, session_id, refresh_token).await;
    assert_eq!(status, StatusCode::OK);
    let next_refresh_token = refreshed["refresh_token"].as_str().unwrap();
    let next_session_id = refreshed["refresh_session_id"].as_str().unwrap();
    assert_eq!(next_session_id, session_id);
    assert_ne!(next_refresh_token, refresh_token);
    let refreshed_access_token = refreshed["token"].as_str().unwrap();
    assert_ne!(refreshed_access_token, original_access_token);
    assert!(refreshed["refresh_expires_at"].as_str().is_some());

    let (replay_status, _) = refresh_session(&app, session_id, refresh_token).await;
    assert_eq!(replay_status, StatusCode::UNAUTHORIZED);

    let (next_status, rotated_again) = refresh_session(&app, session_id, next_refresh_token).await;
    assert_eq!(next_status, StatusCode::OK);
    let third_refresh_token = rotated_again["refresh_token"].as_str().unwrap();
    assert_ne!(third_refresh_token, next_refresh_token);
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
                .uri(format!("/api/conversations/{}/messages", conversation_id))
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
                .uri(format!("/api/conversations/{}/messages", Uuid::new_v4()))
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
    let (config, state, room_service) = make_stream_test_state().await;

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

#[tokio::test]
async fn stream_conversation_rejects_non_participant() {
    let (config, state, room_service) = make_stream_test_state().await;

    let owner_id = "owner".to_string();
    let conversation = room_service
        .create_conversation(vec![owner_id], Some("Unauthorized".into()))
        .await
        .unwrap();

    let stranger_token = sign_token(&config, "stranger", "stranger@example.com");

    let result = stream_conversation(
        Query(StreamQuery {
            token: stranger_token,
        }),
        Path(conversation.id.clone()),
        Extension(state),
    )
    .await;

    assert_eq!(result.unwrap_err(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn stream_conversation_returns_not_found_for_missing_conversation() {
    let (config, state, _room_service) = make_stream_test_state().await;

    let token = sign_token(&config, "user-1", "user@example.com");

    let result = stream_conversation(
        Query(StreamQuery { token }),
        Path(Uuid::new_v4().to_string()),
        Extension(state),
    )
    .await;

    assert_eq!(result.unwrap_err(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn quest_application_flow() {
    let (_config, app_state, _room_service, publisher) = build_state().await;
    let app = router(app_state.clone());

    let owner_email = format!("owner+{}@example.com", Uuid::new_v4());
    let owner_registration = register_user(&app, &owner_email, "password").await;
    let owner_session = login(&app, &owner_email, "password").await;
    let owner_token = owner_session["token"].as_str().unwrap();
    let owner_id = owner_registration["user"]["id"]
        .as_str()
        .unwrap()
        .to_string();

    let quest_payload = json!({
        "title": "Collect Stars",
        "description": "Gather stardust from the nebula",
    });
    let quest_response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/quests")
                .header("authorization", format!("Bearer {owner_token}"))
                .header("content-type", "application/json")
                .body(Body::from(quest_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(quest_response.status(), StatusCode::CREATED);
    let quest_body = body::to_bytes(quest_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let quest_json: serde_json::Value = serde_json::from_slice(&quest_body).unwrap();
    let quest_id = quest_json["id"].as_str().unwrap().to_string();

    let mut receiver = app_state
        .quest_service
        .subscribe(&quest_id)
        .await
        .expect("quest subscription");

    let applicant_email = format!("applicant+{}@example.com", Uuid::new_v4());
    let applicant_registration = register_user(&app, &applicant_email, "password").await;
    let applicant_session = login(&app, &applicant_email, "password").await;
    let applicant_token = applicant_session["token"].as_str().unwrap();
    let applicant_id = applicant_registration["user"]["id"]
        .as_str()
        .unwrap()
        .to_string();

    let apply_payload = json!({ "note": "Ready to help" });
    let apply_response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri(format!("/api/quests/{quest_id}/applications"))
                .header("authorization", format!("Bearer {applicant_token}"))
                .header("content-type", "application/json")
                .body(Body::from(apply_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(apply_response.status(), StatusCode::CREATED);
    let apply_body = body::to_bytes(apply_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let application: serde_json::Value = serde_json::from_slice(&apply_body).unwrap();
    assert_eq!(application["status"], "pending");
    assert_eq!(
        application["applicant_id"].as_str(),
        Some(applicant_id.as_str())
    );
    let application_id = application["id"].as_str().unwrap().to_string();

    let submitted_event = tokio::time::timeout(Duration::from_secs(1), receiver.recv())
        .await
        .expect("quest event timeout")
        .expect("quest submission event");
    assert_eq!(submitted_event.event, "application.submitted");
    assert_eq!(
        submitted_event.data["id"].as_str(),
        Some(application_id.as_str())
    );

    let approve_payload = json!({ "note": "Welcome aboard" });
    let approve_response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri(format!(
                    "/api/quests/{quest_id}/applications/{application_id}/approve"
                ))
                .header("authorization", format!("Bearer {owner_token}"))
                .header("content-type", "application/json")
                .body(Body::from(approve_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(approve_response.status(), StatusCode::OK);
    let approve_body = body::to_bytes(approve_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let approved: serde_json::Value = serde_json::from_slice(&approve_body).unwrap();
    assert_eq!(approved["status"], "approved");
    assert_eq!(approved["reviewed_by"].as_str(), Some(owner_id.as_str()));

    let approved_event = tokio::time::timeout(Duration::from_secs(1), receiver.recv())
        .await
        .expect("quest event timeout")
        .expect("quest approval event");
    assert_eq!(approved_event.event, "application.approved");
    assert_eq!(approved_event.data["status"].as_str(), Some("approved"));

    let list_response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/quests/{quest_id}/applications"))
                .header("authorization", format!("Bearer {owner_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list_response.status(), StatusCode::OK);
    let list_body = body::to_bytes(list_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let list_json: serde_json::Value = serde_json::from_slice(&list_body).unwrap();
    let applications = list_json.as_array().expect("application list");
    assert_eq!(applications.len(), 1);
    assert_eq!(applications[0]["status"], "approved");

    let events = publisher.0.lock().await;
    let quest_subject = format!("ethos.quests.{quest_id}");
    let quest_events: Vec<QuestEvent> = events
        .iter()
        .filter(|(subject, _)| subject == &quest_subject)
        .map(|(_, payload)| serde_json::from_slice::<QuestEvent>(payload).unwrap())
        .collect();
    assert!(quest_events
        .iter()
        .any(|event| event.event == "application.submitted"));
    assert!(quest_events
        .iter()
        .any(|event| event.event == "application.approved"));
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
    let (config, app_state, _room_service, _publisher) = build_state().await;
    let app = router(app_state.clone());

    let email = format!("guilds+{}@example.com", Uuid::new_v4());
    register_user(&app, &email, "password").await;
    let session = login(&app, &email, "password").await;
    let token = session["token"].as_str().unwrap();

    let guild_create = json!({
        "name": "Integration Guild",
        "description": "Initial description",
    });
    let guild_response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/guilds")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(guild_create.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(guild_response.status(), StatusCode::CREATED);
    let guild_body = body::to_bytes(guild_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let guild_json: serde_json::Value = serde_json::from_slice(&guild_body).unwrap();
    let guild_id = guild_json["id"].as_str().unwrap().to_string();

    let quest_create = json!({
        "title": "Quest Persistence",
        "description": "Ensure quests survive pool resets",
        "status": "published",
    });
    let quest_response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/quests")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(quest_create.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(quest_response.status(), StatusCode::CREATED);
    let quest_body = body::to_bytes(quest_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let quest_json: serde_json::Value = serde_json::from_slice(&quest_body).unwrap();
    let quest_id = quest_json["id"].as_str().unwrap().to_string();

    let quest_update = json!({
        "title": "Quest Persistence Updated",
    });
    let update_quest_response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("PUT")
                .uri(format!("/api/quests/{quest_id}"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(quest_update.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(update_quest_response.status(), StatusCode::OK);

    let guild_update = json!({
        "description": "Updated description",
    });
    let update_guild_response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("PUT")
                .uri(format!("/api/guilds/{guild_id}"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(guild_update.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(update_guild_response.status(), StatusCode::OK);

    let (persisted_state, _, _) = rebuild_state(&config).await;
    let persisted_app = router(persisted_state.clone());

    let quest_get_response = persisted_app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/quests/{quest_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(quest_get_response.status(), StatusCode::OK);
    let quest_get_body = body::to_bytes(quest_get_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let quest_after: serde_json::Value = serde_json::from_slice(&quest_get_body).unwrap();
    assert_eq!(quest_after["title"], "Quest Persistence Updated");

    let guild_get_response = persisted_app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/guilds/{guild_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(guild_get_response.status(), StatusCode::OK);
    let guild_get_body = body::to_bytes(guild_get_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let guild_after: serde_json::Value = serde_json::from_slice(&guild_get_body).unwrap();
    assert_eq!(guild_after["description"], "Updated description");

    let delete_quest_response = persisted_app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("DELETE")
                .uri(format!("/api/quests/{quest_id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_quest_response.status(), StatusCode::NO_CONTENT);

    let delete_guild_response = persisted_app
        .oneshot(
            HttpRequest::builder()
                .method("DELETE")
                .uri(format!("/api/guilds/{guild_id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_guild_response.status(), StatusCode::NO_CONTENT);

    let (after_delete_state, _, _) = rebuild_state(&config).await;
    let after_delete_app = router(after_delete_state);

    let quest_missing = after_delete_app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/quests/{quest_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(quest_missing.status(), StatusCode::NOT_FOUND);

    let guild_missing = after_delete_app
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/guilds/{guild_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(guild_missing.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn quest_visibility_controls_drafts() {
    let (_config, app_state, _room_service, _publisher) = build_state().await;
    let app = router(app_state.clone());

    let creator_email = format!("quest-owner+{}@example.com", Uuid::new_v4());
    let register = register_user(&app, &creator_email, "password").await;
    let creator_id = register["user"]["id"].as_str().unwrap().to_string();
    let creator_session = login(&app, &creator_email, "password").await;
    let creator_token = creator_session["token"].as_str().unwrap();

    let quest_create = json!({
        "title": "Hidden Quest",
        "description": "Only the owner should see this draft",
    });
    let create_response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/quests")
                .header("authorization", format!("Bearer {creator_token}"))
                .header("content-type", "application/json")
                .body(Body::from(quest_create.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_response.status(), StatusCode::CREATED);
    let created_body = body::to_bytes(create_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let created: serde_json::Value = serde_json::from_slice(&created_body).unwrap();
    let quest_id = created["id"].as_str().unwrap().to_string();

    let owner_get = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/quests/{quest_id}"))
                .header("authorization", format!("Bearer {creator_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(owner_get.status(), StatusCode::OK);

    let unauth_get = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/quests/{quest_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(unauth_get.status(), StatusCode::NOT_FOUND);

    let viewer_email = format!("quest-viewer+{}@example.com", Uuid::new_v4());
    register_user(&app, &viewer_email, "password").await;
    let viewer_session = login(&app, &viewer_email, "password").await;
    let viewer_token = viewer_session["token"].as_str().unwrap();

    let viewer_get = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/quests/{quest_id}"))
                .header("authorization", format!("Bearer {viewer_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(viewer_get.status(), StatusCode::NOT_FOUND);

    let public_list = app
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
    assert_eq!(public_list.status(), StatusCode::OK);
    let public_body = body::to_bytes(public_list.into_body(), usize::MAX)
        .await
        .unwrap();
    let public_quests: serde_json::Value = serde_json::from_slice(&public_body).unwrap();
    assert!(public_quests.as_array().unwrap().is_empty());

    let publish_body = json!({ "status": "published" });
    let publish_response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("PUT")
                .uri(format!("/api/quests/{quest_id}"))
                .header("authorization", format!("Bearer {creator_token}"))
                .header("content-type", "application/json")
                .body(Body::from(publish_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(publish_response.status(), StatusCode::OK);

    let public_get = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/quests/{quest_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(public_get.status(), StatusCode::OK);

    let viewer_get_published = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri(format!("/api/quests/{quest_id}"))
                .header("authorization", format!("Bearer {viewer_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(viewer_get_published.status(), StatusCode::OK);

    let published_list = app
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri("/api/quests")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(published_list.status(), StatusCode::OK);
    let published_body = body::to_bytes(published_list.into_body(), usize::MAX)
        .await
        .unwrap();
    let published_quests: serde_json::Value = serde_json::from_slice(&published_body).unwrap();
    let quests_array = published_quests.as_array().unwrap();
    assert_eq!(quests_array.len(), 1);
    assert_eq!(quests_array[0]["id"].as_str(), Some(quest_id.as_str()));
    assert_eq!(
        quests_array[0]["creator_id"].as_str(),
        Some(creator_id.as_str())
    );
    assert_eq!(quests_array[0]["status"].as_str(), Some("published"));
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
    assert_eq!(item["visibility"].as_str().unwrap(), "public");

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
    assert_eq!(items[0]["visibility"].as_str().unwrap(), "public");

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("PUT")
                .uri(format!("/api/pods/{pod_id}/items/{item_id}"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({"position": 2, "visibility": "hidden"}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let updated_item_body = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let updated_item: serde_json::Value = serde_json::from_slice(&updated_item_body).unwrap();
    assert_eq!(updated_item["visibility"].as_str().unwrap(), "hidden");

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
    let hidden_items_body = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let hidden_items: serde_json::Value = serde_json::from_slice(&hidden_items_body).unwrap();
    assert_eq!(hidden_items.as_array().unwrap().len(), 1);
    assert_eq!(hidden_items[0]["visibility"].as_str().unwrap(), "hidden");

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
    assert!(snapshot["items"].as_array().unwrap().is_empty());

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("PUT")
                .uri(format!("/api/pods/{pod_id}/items/{item_id}"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(json!({"visibility": "public"}).to_string()))
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
    assert_eq!(
        snapshot["items"][0]["visibility"].as_str().unwrap(),
        "public"
    );

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

#[tokio::test]
async fn artifact_variant_cart_checkout_flow() {
    let (_config, app_state, _room_service, _publisher) = build_state().await;
    let app = router(app_state.clone());

    let email = format!("buyer+{}@example.com", Uuid::new_v4());
    register_user(&app, &email, "password").await;
    let session = login(&app, &email, "password").await;
    let token = session["token"].as_str().unwrap();

    let artifact_body = json!({
        "artifact_type": "collectible",
        "metadata": {"title": "Special Item"}
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/artifacts")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(artifact_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let artifact: serde_json::Value = serde_json::from_slice(
        &body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let artifact_id = artifact["id"].as_str().unwrap();

    let variant_body = json!({
        "name": "Standard Edition",
        "price_cents": 500,
        "metadata": {"description": "Base variant"},
        "options": [
            {
                "name": "Engraving",
                "price_cents": 100,
                "metadata": {"text": "Hello"}
            }
        ]
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri(format!("/api/artifacts/{artifact_id}/variants"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(variant_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let variant_detail: serde_json::Value = serde_json::from_slice(
        &body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let variant_id = variant_detail["variant"]["id"].as_str().unwrap();
    let option_id = variant_detail["options"][0]["id"].as_str().unwrap();

    let add_item_body = json!({
        "variant_id": variant_id,
        "quantity": 2,
        "option_ids": [option_id],
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/cart/items")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(add_item_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let cart_after_add: serde_json::Value = serde_json::from_slice(
        &body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(cart_after_add["items"].as_array().unwrap().len(), 1);
    assert_eq!(cart_after_add["total_cents"].as_i64().unwrap(), 1200);

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri("/api/cart")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let cart_snapshot: serde_json::Value = serde_json::from_slice(
        &body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(cart_snapshot["total_cents"].as_i64().unwrap(), 1200);
    let line_item = &cart_snapshot["items"][0];
    assert_eq!(line_item["item"]["quantity"].as_i64().unwrap(), 2);
    assert_eq!(line_item["subtotal_cents"].as_i64().unwrap(), 1200);

    let checkout_body = json!({
        "status": "processing",
        "metadata": {"note": "integration"}
    });
    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("POST")
                .uri("/api/orders")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(checkout_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let order_detail: serde_json::Value = serde_json::from_slice(
        &body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(order_detail["order"]["total_cents"].as_i64().unwrap(), 1200);
    assert_eq!(
        order_detail["items"][0]["options"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        order_detail["items"][0]["options"][0]["option_id"]
            .as_str()
            .unwrap(),
        option_id
    );

    let response = app
        .clone()
        .oneshot(
            HttpRequest::builder()
                .method("GET")
                .uri("/api/cart")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let cleared_cart: serde_json::Value = serde_json::from_slice(
        &body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(cleared_cart["items"].as_array().unwrap().len(), 0);
    assert_eq!(cleared_cart["total_cents"].as_i64().unwrap(), 0);

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
    let orders_list: serde_json::Value = serde_json::from_slice(
        &body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(orders_list.as_array().unwrap().len(), 1);
    assert_eq!(
        orders_list[0]["order"]["total_cents"].as_i64().unwrap(),
        1200
    );
}
