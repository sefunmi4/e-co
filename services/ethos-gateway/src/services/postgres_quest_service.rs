use std::collections::HashMap;

use anyhow::{anyhow, bail, Context};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde_json::{json, Value};
use tokio_postgres::{types::ToSql, Row};
use uuid::Uuid;

use super::QuestService;

#[derive(Clone)]
pub struct PostgresQuestService {
    pool: Pool,
}

impl PostgresQuestService {
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    fn row_to_value(row: &Row) -> anyhow::Result<Value> {
        let id: Uuid = row.try_get("id")?;
        let creator_id: Uuid = row.try_get("creator_id")?;
        let title: String = row.try_get("title")?;
        let description: Option<String> = row.try_get("description")?;
        let status: String = row.try_get("status")?;
        let created_at: DateTime<Utc> = row.try_get("created_at")?;
        let updated_at: DateTime<Utc> = row.try_get("updated_at")?;
        Ok(json!({
            "id": id.to_string(),
            "creator_id": creator_id.to_string(),
            "title": title,
            "description": description,
            "status": status,
            "created_at": created_at.to_rfc3339(),
            "updated_at": updated_at.to_rfc3339(),
        }))
    }

    fn parse_actor(actor_id: &str) -> anyhow::Result<Uuid> {
        Uuid::parse_str(actor_id).context("invalid actor UUID")
    }

    fn extract_required_string(
        map: &serde_json::Map<String, Value>,
        key: &str,
    ) -> anyhow::Result<String> {
        map.get(key)
            .and_then(Value::as_str)
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .ok_or_else(|| anyhow!("{key} is required"))
    }

    fn extract_optional_text_update(
        map: &serde_json::Map<String, Value>,
        key: &str,
    ) -> anyhow::Result<Option<Option<String>>> {
        match map.get(key) {
            None => Ok(None),
            Some(Value::Null) => Ok(Some(None)),
            Some(Value::String(value)) => Ok(Some(Some(value.trim().to_string()))),
            Some(_) => bail!("{key} must be a string or null"),
        }
    }

    fn parse_uuid_value(value: &Value, key: &str) -> anyhow::Result<Uuid> {
        let id_str = value
            .as_str()
            .ok_or_else(|| anyhow!("{key} must be a string"))?;
        Uuid::parse_str(id_str).with_context(|| format!("invalid {key} UUID"))
    }

    fn collect_uuid_array(value: &Value, key: &str) -> anyhow::Result<Vec<Uuid>> {
        let array = value
            .as_array()
            .ok_or_else(|| anyhow!("{key} must be an array"))?;
        array
            .iter()
            .map(|item| Self::parse_uuid_value(item, key))
            .collect()
    }
}

#[async_trait]
impl QuestService for PostgresQuestService {
    async fn list(
        &self,
        _actor_id: Option<&str>,
        filters: &HashMap<String, Value>,
    ) -> anyhow::Result<Vec<Value>> {
        let client = self
            .pool
            .get()
            .await
            .context("acquire connection for list quests")?;
        let mut query = String::from(
            "SELECT id, creator_id, title, description, status, created_at, updated_at FROM quests",
        );
        let mut conditions = Vec::new();
        let mut params: Vec<Box<dyn ToSql + Sync + Send>> = Vec::new();

        if let Some(value) = filters.get("id") {
            match value {
                Value::String(id) => {
                    let uuid =
                        Uuid::parse_str(id).with_context(|| "invalid id filter".to_string())?;
                    params.push(Box::new(uuid));
                    conditions.push(format!("id = ${}", params.len()));
                }
                Value::Array(_) => {
                    let ids = Self::collect_uuid_array(value, "id")?;
                    if !ids.is_empty() {
                        params.push(Box::new(ids));
                        conditions.push(format!("id = ANY(${})", params.len()));
                    }
                }
                _ => bail!("id filter must be a string or array"),
            }
        }

        if let Some(value) = filters.get("creator_id") {
            match value {
                Value::String(id) => {
                    let uuid = Uuid::parse_str(id)
                        .with_context(|| "invalid creator_id filter".to_string())?;
                    params.push(Box::new(uuid));
                    conditions.push(format!("creator_id = ${}", params.len()));
                }
                Value::Array(_) => {
                    let ids = Self::collect_uuid_array(value, "creator_id")?;
                    if !ids.is_empty() {
                        params.push(Box::new(ids));
                        conditions.push(format!("creator_id = ANY(${})", params.len()));
                    }
                }
                _ => bail!("creator_id filter must be a string or array"),
            }
        }

        if let Some(value) = filters.get("status") {
            match value {
                Value::String(status) => {
                    params.push(Box::new(status.clone()));
                    conditions.push(format!("LOWER(status) = LOWER(${})", params.len()));
                }
                Value::Array(values) => {
                    let statuses: Vec<String> = values
                        .iter()
                        .map(|value| {
                            value
                                .as_str()
                                .map(|value| value.to_string())
                                .ok_or_else(|| anyhow!("status filter must be strings"))
                        })
                        .collect::<anyhow::Result<_>>()?;
                    if !statuses.is_empty() {
                        params.push(Box::new(statuses));
                        conditions.push(format!("status = ANY(${})", params.len()));
                    }
                }
                _ => bail!("status filter must be a string or array"),
            }
        }

        if !conditions.is_empty() {
            query.push_str(" WHERE ");
            query.push_str(&conditions.join(" AND "));
        }
        query.push_str(" ORDER BY created_at DESC");

        let param_refs: Vec<&(dyn ToSql + Sync)> = params
            .iter()
            .map(|param| param.as_ref() as &(dyn ToSql + Sync))
            .collect();
        let rows = client.query(&query, &param_refs).await?;
        rows.into_iter()
            .map(|row| Self::row_to_value(&row))
            .collect()
    }

    async fn get(&self, _actor_id: Option<&str>, id: &str) -> anyhow::Result<Option<Value>> {
        let client = self
            .pool
            .get()
            .await
            .context("acquire connection for get quest")?;
        let quest_id = Uuid::parse_str(id).context("invalid quest id")?;
        let row = client
            .query_opt(
                "SELECT id, creator_id, title, description, status, created_at, updated_at FROM quests WHERE id = $1",
                &[&quest_id],
            )
            .await?;
        match row {
            Some(row) => Ok(Some(Self::row_to_value(&row)?)),
            None => Ok(None),
        }
    }

    async fn create(&self, actor_id: &str, payload: Value) -> anyhow::Result<Value> {
        let creator_id = Self::parse_actor(actor_id)?;
        let map = match payload {
            Value::Object(map) => map,
            _ => bail!("quest payload must be an object"),
        };
        let title = Self::extract_required_string(&map, "title")?;
        let description = match map.get("description") {
            Some(Value::Null) => None,
            Some(Value::String(value)) if !value.trim().is_empty() => {
                Some(value.trim().to_string())
            }
            Some(Value::String(_)) => None,
            Some(_) => bail!("description must be a string"),
            None => None,
        };
        let status = map
            .get("status")
            .and_then(Value::as_str)
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "draft".to_string());
        if map.get("status").is_some()
            && map
                .get("status")
                .and_then(Value::as_str)
                .map(|value| value.trim().is_empty())
                .unwrap_or(false)
        {
            bail!("status must be a non-empty string if provided");
        }
        let id = match map.get("id") {
            Some(Value::String(id)) => Uuid::parse_str(id).context("invalid quest id")?,
            Some(_) => bail!("id must be a string"),
            None => Uuid::new_v4(),
        };

        let client = self
            .pool
            .get()
            .await
            .context("acquire connection for create quest")?;
        let description_param: Option<&str> = description.as_deref();
        let row = client
            .query_one(
                "INSERT INTO quests (id, creator_id, title, description, status) \
                 VALUES ($1, $2, $3, $4, $5) \
                 RETURNING id, creator_id, title, description, status, created_at, updated_at",
                &[&id, &creator_id, &title, &description_param, &status],
            )
            .await?;
        Self::row_to_value(&row)
    }

    async fn update(
        &self,
        actor_id: &str,
        id: &str,
        payload: Value,
    ) -> anyhow::Result<Option<Value>> {
        let actor_uuid = Self::parse_actor(actor_id)?;
        let quest_id = Uuid::parse_str(id).context("invalid quest id")?;
        let map = match payload {
            Value::Object(map) => map,
            Value::Null => serde_json::Map::new(),
            _ => bail!("quest payload must be an object"),
        };

        let mut client = self
            .pool
            .get()
            .await
            .context("acquire connection for update quest")?;
        let transaction = client
            .transaction()
            .await
            .context("begin transaction for update quest")?;
        let existing = transaction
            .query_opt(
                "SELECT id, creator_id, title, description, status, created_at, updated_at \
                 FROM quests WHERE id = $1 FOR UPDATE",
                &[&quest_id],
            )
            .await?;
        let Some(row) = existing else {
            return Ok(None);
        };
        let mut quest = Self::row_to_value(&row)?;
        let quest_creator = row.try_get::<_, Uuid>("creator_id")?;
        if quest_creator != actor_uuid {
            return Ok(None);
        }

        if let Some(value) = map.get("title") {
            let title = value
                .as_str()
                .ok_or_else(|| anyhow!("title must be a string"))?
                .trim()
                .to_string();
            if title.is_empty() {
                bail!("title must be a non-empty string");
            }
            quest["title"] = Value::String(title);
        }

        if let Some(description_change) = Self::extract_optional_text_update(&map, "description")? {
            match description_change {
                Some(description) if description.is_empty() => {
                    quest["description"] = Value::Null;
                }
                Some(description) => {
                    quest["description"] = Value::String(description);
                }
                None => {
                    quest["description"] = Value::Null;
                }
            }
        }

        if let Some(value) = map.get("status") {
            let status = value
                .as_str()
                .ok_or_else(|| anyhow!("status must be a string"))?
                .trim()
                .to_string();
            if status.is_empty() {
                bail!("status must be a non-empty string");
            }
            quest["status"] = Value::String(status);
        }

        let title = quest
            .get("title")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("title missing after update merge"))?
            .to_string();
        let description_param: Option<String> = match quest.get("description") {
            Some(Value::String(value)) => Some(value.clone()),
            Some(Value::Null) | None => None,
            _ => None,
        };
        let status = quest
            .get("status")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("status missing after update merge"))?
            .to_string();

        let description_ref: Option<&str> = description_param.as_deref();
        let row = transaction
            .query_one(
                "UPDATE quests \
                 SET title = $2, description = $3, status = $4, updated_at = NOW() \
                 WHERE id = $1 \
                 RETURNING id, creator_id, title, description, status, created_at, updated_at",
                &[&quest_id, &title, &description_ref, &status],
            )
            .await?;
        transaction
            .commit()
            .await
            .context("commit update quest transaction")?;
        Ok(Some(Self::row_to_value(&row)?))
    }

    async fn delete(&self, actor_id: &str, id: &str) -> anyhow::Result<bool> {
        let actor_uuid = Self::parse_actor(actor_id)?;
        let quest_id = Uuid::parse_str(id).context("invalid quest id")?;
        let client = self
            .pool
            .get()
            .await
            .context("acquire connection for delete quest")?;
        let deleted = client
            .execute(
                "DELETE FROM quests WHERE id = $1 AND creator_id = $2",
                &[&quest_id, &actor_uuid],
            )
            .await?;
        Ok(deleted > 0)
    }
}
