pub mod artifacts;
pub mod orders;
pub mod pod_items;
pub mod pods;
pub mod postgres_guild_service;
pub mod postgres_quest_service;

use std::{collections::HashMap, sync::Arc};

use anyhow::Context;
use async_trait::async_trait;
use chrono::Utc;
use serde_json::Value;
use tokio::sync::{broadcast, Mutex, RwLock};
use uuid::Uuid;

use crate::proto::ethos::v1::{Conversation, Message, Participant, PresenceEvent};

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ChatEvent {
    Message(Message),
    Presence(PresenceEvent),
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct QuestEvent {
    pub quest_id: String,
    pub event: String,
    pub data: Value,
}

#[async_trait]
pub trait RoomService: Send + Sync {
    async fn list_conversations(&self, user_id: &str) -> anyhow::Result<Vec<Conversation>>;
    async fn get_conversation(&self, conversation_id: &str)
        -> anyhow::Result<Option<Conversation>>;
    async fn create_conversation(
        &self,
        user_ids: Vec<String>,
        topic: Option<String>,
    ) -> anyhow::Result<Conversation>;
    async fn append_message(
        &self,
        conversation_id: &str,
        sender_id: &str,
        body: &str,
    ) -> anyhow::Result<Message>;
    async fn history(&self, conversation_id: &str) -> anyhow::Result<Vec<Message>>;
    async fn subscribe(&self, conversation_id: &str) -> Option<broadcast::Receiver<ChatEvent>>;
    async fn update_presence(&self, event: PresenceEvent) -> anyhow::Result<()>;
    async fn presence_snapshot(&self) -> Vec<PresenceEvent>;
    async fn subscribe_presence(&self) -> broadcast::Receiver<PresenceEvent>;
}

pub struct InMemoryRoomService {
    rooms: RwLock<HashMap<String, ConversationRecord>>,
    presence: RwLock<HashMap<String, PresenceEvent>>,
    presence_events: broadcast::Sender<PresenceEvent>,
}

struct ConversationRecord {
    conversation: Conversation,
    messages: Vec<Message>,
    events: broadcast::Sender<ChatEvent>,
}

impl InMemoryRoomService {
    pub fn new() -> Self {
        Self {
            rooms: RwLock::new(HashMap::new()),
            presence: RwLock::new(HashMap::new()),
            presence_events: broadcast::channel(128).0,
        }
    }
}

impl Default for InMemoryRoomService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl RoomService for InMemoryRoomService {
    async fn list_conversations(&self, user_id: &str) -> anyhow::Result<Vec<Conversation>> {
        let rooms = self.rooms.read().await;
        let conversations = rooms
            .values()
            .filter(|record| {
                record
                    .conversation
                    .participants
                    .iter()
                    .any(|p| p.user_id == user_id)
            })
            .map(|record| record.conversation.clone())
            .collect();
        Ok(conversations)
    }

    async fn get_conversation(
        &self,
        conversation_id: &str,
    ) -> anyhow::Result<Option<Conversation>> {
        let rooms = self.rooms.read().await;
        Ok(rooms
            .get(conversation_id)
            .map(|record| record.conversation.clone()))
    }

    async fn create_conversation(
        &self,
        user_ids: Vec<String>,
        topic: Option<String>,
    ) -> anyhow::Result<Conversation> {
        let mut rooms = self.rooms.write().await;
        let id = Uuid::new_v4().to_string();
        let participants = user_ids
            .into_iter()
            .map(|user_id| Participant {
                user_id,
                display_name: String::new(),
                avatar_url: String::new(),
            })
            .collect();
        let conversation = Conversation {
            id: id.clone(),
            topic: topic.unwrap_or_else(|| "Untitled conversation".to_string()),
            participants,
            updated_at: Utc::now().timestamp_millis(),
        };
        let (events, _) = broadcast::channel(256);
        rooms.insert(
            id.clone(),
            ConversationRecord {
                conversation: conversation.clone(),
                messages: Vec::new(),
                events,
            },
        );
        Ok(conversation)
    }

    async fn append_message(
        &self,
        conversation_id: &str,
        sender_id: &str,
        body: &str,
    ) -> anyhow::Result<Message> {
        let mut rooms = self.rooms.write().await;
        let record = rooms
            .get_mut(conversation_id)
            .context("conversation not found")?;
        let message = Message {
            id: Uuid::new_v4().to_string(),
            conversation_id: conversation_id.to_string(),
            sender_id: sender_id.to_string(),
            body: body.to_string(),
            timestamp_ms: Utc::now().timestamp_millis(),
        };
        record.conversation.updated_at = message.timestamp_ms;
        record.messages.push(message.clone());
        let _ = record.events.send(ChatEvent::Message(message.clone()));
        Ok(message)
    }

    async fn history(&self, conversation_id: &str) -> anyhow::Result<Vec<Message>> {
        let rooms = self.rooms.read().await;
        let record = rooms
            .get(conversation_id)
            .context("conversation not found")?;
        Ok(record.messages.clone())
    }

    async fn subscribe(&self, conversation_id: &str) -> Option<broadcast::Receiver<ChatEvent>> {
        let rooms = self.rooms.read().await;
        rooms
            .get(conversation_id)
            .map(|record| record.events.subscribe())
    }

    async fn update_presence(&self, event: PresenceEvent) -> anyhow::Result<()> {
        let mut presence = self.presence.write().await;
        presence.insert(event.user_id.clone(), event.clone());
        let rooms = self.rooms.read().await;
        for record in rooms.values() {
            let _ = record.events.send(ChatEvent::Presence(event.clone()));
        }
        let _ = self.presence_events.send(event);
        Ok(())
    }

    async fn presence_snapshot(&self) -> Vec<PresenceEvent> {
        let presence = self.presence.read().await;
        presence.values().cloned().collect()
    }

    async fn subscribe_presence(&self) -> broadcast::Receiver<PresenceEvent> {
        self.presence_events.subscribe()
    }
}

#[async_trait]
pub trait EventPublisher: Send + Sync {
    async fn publish(&self, subject: &str, payload: &[u8]) -> anyhow::Result<()>;
}

pub struct NoopPublisher;

#[async_trait]
impl EventPublisher for NoopPublisher {
    async fn publish(&self, _subject: &str, _payload: &[u8]) -> anyhow::Result<()> {
        Ok(())
    }
}

#[async_trait]
pub trait QuestService: Send + Sync {
    async fn list(
        &self,
        actor_id: Option<&str>,
        filters: &HashMap<String, Value>,
    ) -> anyhow::Result<Vec<Value>>;
    async fn get(&self, actor_id: Option<&str>, id: &str) -> anyhow::Result<Option<Value>>;
    async fn create(&self, actor_id: &str, payload: Value) -> anyhow::Result<Value>;
    async fn update(
        &self,
        actor_id: &str,
        id: &str,
        payload: Value,
    ) -> anyhow::Result<Option<Value>>;
    async fn delete(&self, actor_id: &str, id: &str) -> anyhow::Result<bool>;
    async fn apply(
        &self,
        actor_id: &str,
        quest_id: &str,
        payload: Value,
    ) -> anyhow::Result<Option<Value>>;
    async fn list_applications(&self, actor_id: &str, quest_id: &str)
        -> anyhow::Result<Vec<Value>>;
    async fn approve_application(
        &self,
        actor_id: &str,
        quest_id: &str,
        application_id: &str,
        payload: Value,
    ) -> anyhow::Result<Option<Value>>;
    async fn reject_application(
        &self,
        actor_id: &str,
        quest_id: &str,
        application_id: &str,
        payload: Value,
    ) -> anyhow::Result<Option<Value>>;
    async fn subscribe(&self, quest_id: &str) -> anyhow::Result<broadcast::Receiver<QuestEvent>>;
}

#[async_trait]
pub trait GuildService: Send + Sync {
    async fn list(
        &self,
        actor_id: Option<&str>,
        filters: &HashMap<String, Value>,
    ) -> anyhow::Result<Vec<Value>>;
    async fn get(&self, actor_id: Option<&str>, id: &str) -> anyhow::Result<Option<Value>>;
    async fn create(&self, actor_id: &str, payload: Value) -> anyhow::Result<Value>;
    async fn update(
        &self,
        actor_id: &str,
        id: &str,
        payload: Value,
    ) -> anyhow::Result<Option<Value>>;
    async fn delete(&self, actor_id: &str, id: &str) -> anyhow::Result<bool>;
}

pub use postgres_guild_service::PostgresGuildService;
pub use postgres_quest_service::PostgresQuestService;

pub struct NatsPublisher {
    client: async_nats::Client,
}

impl NatsPublisher {
    pub async fn connect(url: &str) -> anyhow::Result<Self> {
        let client = async_nats::connect(url).await?;
        Ok(Self { client })
    }
}

#[async_trait]
impl EventPublisher for NatsPublisher {
    async fn publish(&self, subject: &str, payload: &[u8]) -> anyhow::Result<()> {
        self.client
            .publish(subject.to_string(), payload.to_vec().into())
            .await?;
        Ok(())
    }
}

type EventLog = Mutex<Vec<(String, Vec<u8>)>>;

pub struct TestPublisher(pub Arc<EventLog>);

#[async_trait]
impl EventPublisher for TestPublisher {
    async fn publish(&self, subject: &str, payload: &[u8]) -> anyhow::Result<()> {
        let mut guard = self.0.lock().await;
        guard.push((subject.to_string(), payload.to_vec()));
        Ok(())
    }
}

impl Default for TestPublisher {
    fn default() -> Self {
        Self(Arc::new(Mutex::new(Vec::new())))
    }
}
