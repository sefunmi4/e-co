use std::{collections::HashMap, sync::Arc};

use anyhow::Context;
use async_trait::async_trait;
use chrono::Utc;
use serde_json::{json, Map, Value};
use tokio::sync::{broadcast, Mutex, RwLock};
use uuid::Uuid;

use crate::proto::ethos::v1::{Conversation, Message, Participant, PresenceEvent};

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ChatEvent {
    Message(Message),
    Presence(PresenceEvent),
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
    async fn list(&self, filters: &HashMap<String, Value>) -> anyhow::Result<Vec<Value>>;
    async fn get(&self, id: &str) -> anyhow::Result<Option<Value>>;
    async fn create(&self, payload: Value) -> anyhow::Result<Value>;
    async fn update(&self, id: &str, payload: Value) -> anyhow::Result<Option<Value>>;
    async fn delete(&self, id: &str) -> anyhow::Result<bool>;
}

#[async_trait]
pub trait GuildService: Send + Sync {
    async fn list(&self, filters: &HashMap<String, Value>) -> anyhow::Result<Vec<Value>>;
    async fn get(&self, id: &str) -> anyhow::Result<Option<Value>>;
    async fn create(&self, payload: Value) -> anyhow::Result<Value>;
    async fn update(&self, id: &str, payload: Value) -> anyhow::Result<Option<Value>>;
    async fn delete(&self, id: &str) -> anyhow::Result<bool>;
}

#[derive(Default)]
pub struct InMemoryQuestService {
    quests: RwLock<HashMap<String, Value>>,
}

impl InMemoryQuestService {
    pub fn new() -> Self {
        let mut quests = HashMap::new();
        for quest in seed_quests() {
            if let Some(id) = quest.get("id").and_then(Value::as_str) {
                quests.insert(id.to_string(), quest);
            }
        }
        Self {
            quests: RwLock::new(quests),
        }
    }
}

#[async_trait]
impl QuestService for InMemoryQuestService {
    async fn list(&self, filters: &HashMap<String, Value>) -> anyhow::Result<Vec<Value>> {
        let quests = self.quests.read().await;
        let results = quests
            .values()
            .filter(|quest| matches_filters(quest, filters))
            .cloned()
            .collect();
        Ok(results)
    }

    async fn get(&self, id: &str) -> anyhow::Result<Option<Value>> {
        let quests = self.quests.read().await;
        Ok(quests.get(id).cloned())
    }

    async fn create(&self, payload: Value) -> anyhow::Result<Value> {
        let mut quests = self.quests.write().await;
        let mut stored = ensure_object(payload, true)?;
        let id = stored
            .get("id")
            .and_then(Value::as_str)
            .map(String::from)
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        stored.insert("id".to_string(), Value::String(id.clone()));
        ensure_timestamps(&mut stored);
        stored
            .entry("is_archived".to_string())
            .or_insert(Value::Bool(false));
        let value = Value::Object(stored.clone());
        quests.insert(id, value.clone());
        Ok(value)
    }

    async fn update(&self, id: &str, payload: Value) -> anyhow::Result<Option<Value>> {
        let mut quests = self.quests.write().await;
        let updates = ensure_object(payload, false)?;
        if let Some(existing) = quests.get_mut(id) {
            if let Some(map) = existing.as_object_mut() {
                for (key, value) in updates {
                    map.insert(key, value);
                }
                map.insert("id".to_string(), Value::String(id.to_string()));
                ensure_timestamps(map);
                return Ok(Some(Value::Object(map.clone())));
            }
        }
        Ok(None)
    }

    async fn delete(&self, id: &str) -> anyhow::Result<bool> {
        let mut quests = self.quests.write().await;
        Ok(quests.remove(id).is_some())
    }
}

#[derive(Default)]
pub struct InMemoryGuildService {
    guilds: RwLock<HashMap<String, Value>>,
}

impl InMemoryGuildService {
    pub fn new() -> Self {
        let mut guilds = HashMap::new();
        for guild in seed_guilds() {
            if let Some(id) = guild.get("id").and_then(Value::as_str) {
                guilds.insert(id.to_string(), guild);
            }
        }
        Self {
            guilds: RwLock::new(guilds),
        }
    }
}

#[async_trait]
impl GuildService for InMemoryGuildService {
    async fn list(&self, filters: &HashMap<String, Value>) -> anyhow::Result<Vec<Value>> {
        let guilds = self.guilds.read().await;
        let results = guilds
            .values()
            .filter(|guild| matches_filters(guild, filters))
            .cloned()
            .collect();
        Ok(results)
    }

    async fn get(&self, id: &str) -> anyhow::Result<Option<Value>> {
        let guilds = self.guilds.read().await;
        Ok(guilds.get(id).cloned())
    }

    async fn create(&self, payload: Value) -> anyhow::Result<Value> {
        let mut guilds = self.guilds.write().await;
        let mut stored = ensure_object(payload, true)?;
        let id = stored
            .get("id")
            .and_then(Value::as_str)
            .map(String::from)
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        stored.insert("id".to_string(), Value::String(id.clone()));
        ensure_timestamps(&mut stored);
        stored
            .entry("is_archived".to_string())
            .or_insert(Value::Bool(false));
        let value = Value::Object(stored.clone());
        guilds.insert(id, value.clone());
        Ok(value)
    }

    async fn update(&self, id: &str, payload: Value) -> anyhow::Result<Option<Value>> {
        let mut guilds = self.guilds.write().await;
        let updates = ensure_object(payload, false)?;
        if let Some(existing) = guilds.get_mut(id) {
            if let Some(map) = existing.as_object_mut() {
                for (key, value) in updates {
                    map.insert(key, value);
                }
                map.insert("id".to_string(), Value::String(id.to_string()));
                ensure_timestamps(map);
                return Ok(Some(Value::Object(map.clone())));
            }
        }
        Ok(None)
    }

    async fn delete(&self, id: &str) -> anyhow::Result<bool> {
        let mut guilds = self.guilds.write().await;
        Ok(guilds.remove(id).is_some())
    }
}

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

fn ensure_object(payload: Value, allow_empty: bool) -> anyhow::Result<Map<String, Value>> {
    match payload {
        Value::Object(map) => Ok(map),
        Value::Null if allow_empty => Ok(Map::new()),
        _ => anyhow::bail!("expected JSON object payload"),
    }
}

fn ensure_timestamps(map: &mut Map<String, Value>) {
    let now = Utc::now().to_rfc3339();
    map.entry("updated_at".to_string())
        .and_modify(|value| *value = Value::String(now.clone()))
        .or_insert_with(|| Value::String(now.clone()));
    map.entry("updated_date".to_string())
        .and_modify(|value| *value = Value::String(now.clone()))
        .or_insert_with(|| Value::String(now.clone()));
    map.entry("created_date".to_string())
        .or_insert_with(|| Value::String(now));
}

fn matches_filters(record: &Value, filters: &HashMap<String, Value>) -> bool {
    let Some(object) = record.as_object() else {
        return false;
    };
    filters.iter().all(|(key, expected)| match object.get(key) {
        Some(value) => value_matches(value, expected),
        None => expected.is_null(),
    })
}

fn value_matches(value: &Value, expected: &Value) -> bool {
    match (value, expected) {
        (_, Value::Array(options)) => options.iter().any(|option| value_matches(value, option)),
        (Value::Array(values), other) => values
            .iter()
            .any(|candidate| value_matches(candidate, other)),
        (Value::String(actual), Value::String(expected)) => actual.eq_ignore_ascii_case(expected),
        (Value::String(actual), Value::Bool(expected)) => match expected {
            true => actual.eq_ignore_ascii_case("true"),
            false => actual.eq_ignore_ascii_case("false"),
        },
        (Value::Bool(actual), Value::String(expected)) => match expected.as_str() {
            "true" => *actual,
            "false" => !*actual,
            _ => false,
        },
        (Value::Bool(actual), Value::Bool(expected)) => actual == expected,
        (Value::Number(actual), Value::String(expected)) => actual.to_string() == *expected,
        (Value::Number(actual), Value::Number(expected)) => actual == expected,
        (Value::Null, Value::Null) => true,
        (Value::Null, Value::Bool(expected)) => !*expected,
        (Value::Null, Value::String(expected)) => expected.is_empty(),
        (actual, expected) => actual == expected,
    }
}

fn seed_quests() -> Vec<Value> {
    vec![
        json!({
            "id": "quest-example-community-launch",
            "title": "Launch the community knowledge base",
            "description": "Curate onboarding guides and publish a knowledge base for new community members.",
            "status": "in_progress",
            "priority": "high",
            "quest_type": "project_quest",
            "request_type": "team_help",
            "created_by": "alice@example.com",
            "created_date": "2024-01-10T12:00:00Z",
            "updated_at": "2024-01-15T09:00:00Z",
            "updated_date": "2024-01-15T09:00:00Z",
            "guild_id": "guild-creative-coders",
            "is_public": true,
            "is_archived": false,
            "collaborators": ["bob@example.com"],
            "team_roles": [
                { "role_type": "designer", "count": 1 },
                { "role_type": "technical_writer", "count": 1 }
            ],
            "tags": ["documentation", "design"],
            "estimated_hours": 40,
            "completion_percentage": 45,
            "likes": 3,
        }),
        json!({
            "id": "quest-example-feedback-circle",
            "title": "Host the monthly feedback circle",
            "description": "Gather product feedback from the guild and summarize takeaways for the core team.",
            "status": "open",
            "priority": "medium",
            "quest_type": "discussion",
            "request_type": "feedback",
            "created_by": "carol@example.com",
            "created_date": "2024-02-01T18:30:00Z",
            "updated_at": "2024-02-02T08:00:00Z",
            "updated_date": "2024-02-02T08:00:00Z",
            "guild_id": "guild-product-explorers",
            "is_public": true,
            "is_archived": false,
            "collaborators": [],
            "team_roles": [],
            "tags": ["facilitation", "community"],
            "estimated_hours": 6,
            "completion_percentage": 10,
            "likes": 1,
        }),
    ]
}

fn seed_guilds() -> Vec<Value> {
    vec![
        json!({
            "id": "guild-creative-coders",
            "name": "Creative Coders",
            "description": "A collective of designers and developers shipping community tools.",
            "created_by": "alice@example.com",
            "created_date": "2023-11-20T09:00:00Z",
            "updated_at": "2024-02-01T08:00:00Z",
            "updated_date": "2024-02-01T08:00:00Z",
            "is_public": true,
            "is_archived": false,
            "guild_type": "developer",
            "is_party": false,
            "member_count": 12,
            "quest_count": 5,
            "passcode": null,
            "focus_areas": ["Open source", "Design systems"],
            "avatar_url": null,
        }),
        json!({
            "id": "guild-product-explorers",
            "name": "Product Explorers",
            "description": "Researchers and storytellers sharing insights from user interviews.",
            "created_by": "carol@example.com",
            "created_date": "2023-10-05T14:00:00Z",
            "updated_at": "2024-01-22T10:30:00Z",
            "updated_date": "2024-01-22T10:30:00Z",
            "is_public": false,
            "is_archived": false,
            "guild_type": "explorer",
            "is_party": true,
            "member_count": 6,
            "quest_count": 3,
            "passcode": "explore-more",
            "focus_areas": ["Research", "Community"],
            "avatar_url": null,
        }),
    ]
}
