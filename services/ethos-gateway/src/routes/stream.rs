use std::{convert::Infallible, sync::Arc};

use axum::{
    extract::{Path, Query},
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    Extension,
};
use futures::Stream;
use serde::Deserialize;
use serde_json::json;
use tokio::time::{self, Duration, MissedTickBehavior};

use crate::{auth, services::ChatEvent, state::AppState};

use super::conversations::ensure_conversation_participant;

#[derive(Debug, Deserialize)]
pub struct StreamQuery {
    pub token: String,
}

pub async fn stream_conversation(
    Query(query): Query<StreamQuery>,
    Path(id): Path<String>,
    Extension(state): Extension<Arc<AppState>>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    let claims = auth::decode_token(&state.config.jwt_secret, &query.token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let _conversation = ensure_conversation_participant(&state, &id, &claims.sub).await?;

    let history = state.room_service.history(&id).await.unwrap_or_default();
    let mut receiver = state
        .room_service
        .subscribe(&id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    let room_service = state.room_service.clone();

    let stream = async_stream::stream! {
        for message in history {
            match Event::default().event("message").json_data(json!({
                "type": "message",
                "message": message,
            })) {
                Ok(event) => yield Ok(event),
                Err(error) => {
                    tracing::warn!("failed to serialise history event: {error}");
                }
            }
        }

        match Event::default().event("presence").json_data(json!({
            "type": "presence",
            "presence": room_service.presence_snapshot().await,
        })) {
            Ok(event) => yield Ok(event),
            Err(error) => tracing::warn!("failed to serialise presence snapshot: {error}"),
        }

        let mut interval = time::interval(Duration::from_secs(10));
        interval.set_missed_tick_behavior(MissedTickBehavior::Delay);
        interval.tick().await;

        loop {
            tokio::select! {
                biased;
                result = receiver.recv() => {
                    match result {
                        Ok(ChatEvent::Message(message)) => {
                            match Event::default().event("message").json_data(json!({
                                "type": "message",
                                "message": message,
                            })) {
                                Ok(event) => yield Ok(event),
                                Err(error) => tracing::warn!("failed to serialise message event: {error}"),
                            }
                        }
                        Ok(ChatEvent::Presence(presence)) => {
                            match Event::default().event("presence").json_data(json!({
                                "type": "presence",
                                "presence": presence,
                            })) {
                                Ok(event) => yield Ok(event),
                                Err(error) => tracing::warn!("failed to serialise presence event: {error}"),
                            }
                        }
                        Err(_) => break,
                    }
                }
                _ = interval.tick() => {
                    match Event::default().event("presence").json_data(json!({
                        "type": "presence",
                        "presence": room_service.presence_snapshot().await,
                    })) {
                        Ok(event) => yield Ok(event),
                        Err(error) => tracing::warn!("failed to serialise presence snapshot: {error}"),
                    }
                }
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}
