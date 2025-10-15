use std::sync::Arc;

use axum::{extract::Path, Extension, Json};
use serde::{Deserialize, Serialize};

use crate::{
    auth::AuthSession,
    proto::ethos::v1::{Conversation, Message, PresenceEvent},
    services::ChatEvent,
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct ConversationPayload {
    pub id: String,
    pub topic: String,
    pub participants: Vec<crate::proto::ethos::v1::Participant>,
    pub updated_at: i64,
    pub messages: Vec<Message>,
}

#[derive(Debug, Serialize)]
pub struct ConversationsEnvelope {
    pub conversations: Vec<ConversationPayload>,
    pub presence: Vec<PresenceEvent>,
}

#[derive(Debug, Deserialize)]
pub struct CreateConversationBody {
    pub participant_user_ids: Vec<String>,
    pub topic: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PostMessageBody {
    pub body: String,
}

fn map_conversation(conversation: Conversation, messages: Vec<Message>) -> ConversationPayload {
    ConversationPayload {
        id: conversation.id,
        topic: conversation.topic,
        participants: conversation.participants,
        updated_at: conversation.updated_at,
        messages,
    }
}

pub async fn list_conversations(
    auth: AuthSession,
    Extension(state): Extension<Arc<AppState>>,
) -> Result<Json<ConversationsEnvelope>, axum::http::StatusCode> {
    let conversations = state
        .room_service
        .list_conversations(&auth.user_id)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut payloads = Vec::new();
    for conversation in conversations {
        let _ = state.matrix.ensure_room(&conversation).await;
        let history = state
            .room_service
            .history(&conversation.id)
            .await
            .unwrap_or_default();
        payloads.push(map_conversation(conversation, history));
    }
    let presence = state.room_service.presence_snapshot().await;
    Ok(Json(ConversationsEnvelope {
        conversations: payloads,
        presence,
    }))
}

pub async fn create_conversation(
    auth: AuthSession,
    Extension(state): Extension<Arc<AppState>>,
    Json(body): Json<CreateConversationBody>,
) -> Result<Json<ConversationPayload>, axum::http::StatusCode> {
    let mut participants = body.participant_user_ids.clone();
    if !participants.contains(&auth.user_id) {
        participants.push(auth.user_id.clone());
    }
    let conversation = state
        .room_service
        .create_conversation(participants, body.topic)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let _ = state.matrix.ensure_room(&conversation).await;
    Ok(Json(map_conversation(conversation, Vec::new())))
}

pub async fn list_messages(
    auth: AuthSession,
    Extension(state): Extension<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Message>>, axum::http::StatusCode> {
    let conversation = state
        .room_service
        .get_conversation(&id)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let conversation = match conversation {
        Some(conversation) => conversation,
        None => return Err(axum::http::StatusCode::NOT_FOUND),
    };

    let is_participant = conversation
        .participants
        .iter()
        .any(|participant| participant.user_id == auth.user_id);

    if !is_participant {
        return Err(axum::http::StatusCode::FORBIDDEN);
    }

    let history = state
        .room_service
        .history(&id)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(history))
}

pub async fn post_message(
    auth: AuthSession,
    Extension(state): Extension<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<PostMessageBody>,
) -> Result<Json<Message>, axum::http::StatusCode> {
    let message = state
        .room_service
        .append_message(&id, &auth.user_id, &body.body)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    if let Ok(Some(conversation)) = state.room_service.get_conversation(&id).await {
        let _ = state.matrix.send_message(&conversation, &message).await;
    }
    if let Ok(payload) = serde_json::to_vec(&ChatEvent::Message(message.clone())) {
        let _ = state
            .publisher
            .publish(&format!("ethos.chat.{}", id), &payload)
            .await;
    }
    Ok(Json(message))
}
