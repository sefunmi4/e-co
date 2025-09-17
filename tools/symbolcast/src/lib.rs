pub mod proto {
    pub mod symbolcast {
        tonic::include_proto!("eco.symbolcast");
    }
}

use async_nats::Client;
use proto::symbolcast::symbol_cast_server::{SymbolCast, SymbolCastServer};
use proto::symbolcast::{Gesture, PointerEvent};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;
use tonic::{Request, Response, Status};
use tracing::{debug, info, warn};

const GESTURE_CONFIDENCE: f32 = 0.92;
const GESTURE_SUBJECT: &str = "eco.gesture.detected";
const ACTION_SUBJECT: &str = "eco.action.cast";

#[derive(Clone, Copy)]
struct GestureTemplate {
    id: &'static str,
    label: &'static str,
    action_kind: &'static str,
    payload: &'static str,
}

const GESTURE_TEMPLATES: [GestureTemplate; 3] = [
    GestureTemplate {
        id: "triangle",
        label: "Triangle",
        action_kind: "open_search",
        payload: "{\"target\":\"search\"}",
    },
    GestureTemplate {
        id: "circle",
        label: "Circle",
        action_kind: "snap_panel",
        payload: "{\"target\":\"panel\"}",
    },
    GestureTemplate {
        id: "square",
        label: "Square",
        action_kind: "next_portal",
        payload: "{\"direction\":\"forward\"}",
    },
];

#[derive(Debug, Serialize)]
struct GestureEvent {
    id: String,
    label: String,
    confidence: f32,
}

#[derive(Debug, Serialize)]
struct ActionEvent {
    id: String,
    kind: String,
    payload: String,
    requested_by: &'static str,
}

#[derive(Clone)]
pub struct SymbolCastService {
    cursor: Arc<Mutex<usize>>,
    nats: Option<Client>,
}

impl SymbolCastService {
    pub async fn new() -> Self {
        let url = std::env::var("NATS_URL").unwrap_or_else(|_| "nats://127.0.0.1:4222".to_string());
        let nats = match async_nats::connect(url.clone()).await {
            Ok(client) => {
                info!(%url, "symbolcastd connected to NATS");
                Some(client)
            }
            Err(err) => {
                warn!(%url, ?err, "continuing without NATS connection");
                None
            }
        };
        Self::with_nats(nats)
    }

    pub fn with_nats(nats: Option<Client>) -> Self {
        Self {
            cursor: Arc::new(Mutex::new(0)),
            nats,
        }
    }

    async fn classify(&self, events: Vec<PointerEvent>) -> Gesture {
        debug!(count = events.len(), "classifying pointer stream");
        let template = self.next_template().await;
        self.publish_gesture(template, GESTURE_CONFIDENCE).await;
        self.publish_action(template).await;
        Gesture {
            id: template.id.to_string(),
            label: template.label.to_string(),
            confidence: GESTURE_CONFIDENCE,
        }
    }

    async fn next_template(&self) -> GestureTemplate {
        let mut cursor = self.cursor.lock().await;
        let template = GESTURE_TEMPLATES[*cursor % GESTURE_TEMPLATES.len()];
        *cursor = (*cursor + 1) % GESTURE_TEMPLATES.len();
        template
    }

    async fn publish_gesture(&self, template: GestureTemplate, confidence: f32) {
        if let Some(client) = &self.nats {
            let event = GestureEvent {
                id: template.id.to_string(),
                label: template.label.to_string(),
                confidence,
            };
            match serde_json::to_vec(&event) {
                Ok(bytes) => {
                    if let Err(err) = client.publish(GESTURE_SUBJECT, bytes.into()).await {
                        warn!(?err, "failed to publish gesture event");
                    }
                }
                Err(err) => warn!(?err, "failed to serialise gesture event"),
            }
        }
    }

    async fn publish_action(&self, template: GestureTemplate) {
        if let Some(client) = &self.nats {
            let event = ActionEvent {
                id: format!("action-{}", template.id),
                kind: template.action_kind.to_string(),
                payload: template.payload.to_string(),
                requested_by: "symbolcastd",
            };
            match serde_json::to_vec(&event) {
                Ok(bytes) => {
                    if let Err(err) = client.publish(ACTION_SUBJECT, bytes.into()).await {
                        warn!(?err, "failed to publish action event");
                    }
                }
                Err(err) => warn!(?err, "failed to serialise action event"),
            }
        }
    }
}

#[tonic::async_trait]
impl SymbolCast for SymbolCastService {
    async fn recognize(
        &self,
        request: Request<tonic::Streaming<PointerEvent>>,
    ) -> Result<Response<Gesture>, Status> {
        let mut stream = request.into_inner();
        let mut events = Vec::new();
        while let Some(event) = stream.message().await? {
            debug!(x = event.x, y = event.y, pressure = event.pressure, device = %event.device_id, "received pointer event");
            events.push(event);
        }
        let gesture = self.classify(events).await;
        Ok(Response::new(gesture))
    }
}

pub fn server(service: SymbolCastService) -> SymbolCastServer<SymbolCastService> {
    SymbolCastServer::new(service)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn cycles_gestures() {
        let service = SymbolCastService::with_nats(None);
        let first = service.classify(Vec::new()).await;
        let second = service.classify(Vec::new()).await;
        assert_eq!(first.id, "triangle");
        assert_eq!(second.id, "circle");
    }
}
