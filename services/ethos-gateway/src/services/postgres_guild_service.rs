use std::collections::HashMap;

use anyhow::{anyhow, bail, Context};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde_json::{json, Value};
use tokio_postgres::{types::ToSql, Row};
use uuid::Uuid;

use super::GuildService;

#[derive(Clone)]
pub struct PostgresGuildService {
    pool: Pool,
}

impl PostgresGuildService {
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    fn row_to_value(row: &Row) -> anyhow::Result<Value> {
        let id: Uuid = row.try_get("id")?;
        let owner_id: Uuid = row.try_get("owner_id")?;
        let name: String = row.try_get("name")?;
        let description: Option<String> = row.try_get("description")?;
        let created_at: DateTime<Utc> = row.try_get("created_at")?;
        Ok(json!({
            "id": id.to_string(),
            "owner_id": owner_id.to_string(),
            "name": name,
            "description": description,
            "created_at": created_at.to_rfc3339(),
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
impl GuildService for PostgresGuildService {
    async fn list(
        &self,
        actor_id: Option<&str>,
        filters: &HashMap<String, Value>,
    ) -> anyhow::Result<Vec<Value>> {
        let client = self
            .pool
            .get()
            .await
            .context("acquire connection for list guilds")?;
        let mut query = String::from(
            "SELECT DISTINCT g.id, g.owner_id, g.name, g.description, g.created_at FROM guilds g",
        );
        let mut joins = Vec::new();
        let mut conditions = Vec::new();
        let mut params: Vec<Box<dyn ToSql + Sync + Send>> = Vec::new();

        let mut member_ids: Vec<Uuid> = Vec::new();
        if let Some(actor_id) = actor_id {
            member_ids.push(Self::parse_actor(actor_id)?);
        }
        if let Some(value) = filters.get("member_id") {
            match value {
                Value::String(id) => {
                    member_ids.push(
                        Uuid::parse_str(id)
                            .with_context(|| "invalid member_id filter".to_string())?,
                    );
                }
                Value::Array(_) => {
                    let ids = Self::collect_uuid_array(value, "member_id")?;
                    member_ids.extend(ids);
                }
                _ => bail!("member_id filter must be a string or array"),
            }
        }
        if !member_ids.is_empty() {
            joins.push("JOIN memberships m ON m.guild_id = g.id".to_string());
            params.push(Box::new(member_ids));
            conditions.push(format!("m.user_id = ANY(${})", params.len()));
        }

        if let Some(value) = filters.get("id") {
            match value {
                Value::String(id) => {
                    let uuid =
                        Uuid::parse_str(id).with_context(|| "invalid id filter".to_string())?;
                    params.push(Box::new(uuid));
                    conditions.push(format!("g.id = ${}", params.len()));
                }
                Value::Array(_) => {
                    let ids = Self::collect_uuid_array(value, "id")?;
                    if !ids.is_empty() {
                        params.push(Box::new(ids));
                        conditions.push(format!("g.id = ANY(${})", params.len()));
                    }
                }
                _ => bail!("id filter must be a string or array"),
            }
        }

        if let Some(value) = filters.get("owner_id") {
            match value {
                Value::String(id) => {
                    let uuid = Uuid::parse_str(id)
                        .with_context(|| "invalid owner_id filter".to_string())?;
                    params.push(Box::new(uuid));
                    conditions.push(format!("g.owner_id = ${}", params.len()));
                }
                Value::Array(_) => {
                    let ids = Self::collect_uuid_array(value, "owner_id")?;
                    if !ids.is_empty() {
                        params.push(Box::new(ids));
                        conditions.push(format!("g.owner_id = ANY(${})", params.len()));
                    }
                }
                _ => bail!("owner_id filter must be a string or array"),
            }
        }

        if let Some(value) = filters.get("name") {
            let pattern = value
                .as_str()
                .ok_or_else(|| anyhow!("name filter must be a string"))?
                .trim()
                .to_string();
            if !pattern.is_empty() {
                params.push(Box::new(format!("%{}%", pattern)));
                conditions.push(format!("g.name ILIKE ${}", params.len()));
            }
        }

        if !joins.is_empty() {
            query.push(' ');
            query.push_str(&joins.join(" "));
        }
        if !conditions.is_empty() {
            query.push_str(" WHERE ");
            query.push_str(&conditions.join(" AND "));
        }
        query.push_str(" ORDER BY g.created_at DESC");

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
            .context("acquire connection for get guild")?;
        let guild_id = Uuid::parse_str(id).context("invalid guild id")?;
        let row = client
            .query_opt(
                "SELECT id, owner_id, name, description, created_at FROM guilds WHERE id = $1",
                &[&guild_id],
            )
            .await?;
        match row {
            Some(row) => Ok(Some(Self::row_to_value(&row)?)),
            None => Ok(None),
        }
    }

    async fn create(&self, actor_id: &str, payload: Value) -> anyhow::Result<Value> {
        let owner_id = Self::parse_actor(actor_id)?;
        let map = match payload {
            Value::Object(map) => map,
            _ => bail!("guild payload must be an object"),
        };
        let name = Self::extract_required_string(&map, "name")?;
        let description = match map.get("description") {
            Some(Value::Null) => None,
            Some(Value::String(value)) if !value.trim().is_empty() => {
                Some(value.trim().to_string())
            }
            Some(Value::String(_)) => None,
            Some(_) => bail!("description must be a string"),
            None => None,
        };
        let id = match map.get("id") {
            Some(Value::String(id)) => Uuid::parse_str(id).context("invalid guild id")?,
            Some(_) => bail!("id must be a string"),
            None => Uuid::new_v4(),
        };

        let mut client = self
            .pool
            .get()
            .await
            .context("acquire connection for create guild")?;
        let transaction = client
            .transaction()
            .await
            .context("begin transaction for create guild")?;
        let description_param: Option<&str> = description.as_deref();
        let row = transaction
            .query_one(
                "INSERT INTO guilds (id, owner_id, name, description) \
                 VALUES ($1, $2, $3, $4) \
                 RETURNING id, owner_id, name, description, created_at",
                &[&id, &owner_id, &name, &description_param],
            )
            .await?;
        transaction
            .execute(
                "INSERT INTO memberships (guild_id, user_id, role) VALUES ($1, $2, 'owner') \
                 ON CONFLICT (guild_id, user_id) DO UPDATE SET role = EXCLUDED.role",
                &[&id, &owner_id],
            )
            .await?;
        transaction
            .commit()
            .await
            .context("commit create guild transaction")?;
        Self::row_to_value(&row)
    }

    async fn update(
        &self,
        actor_id: &str,
        id: &str,
        payload: Value,
    ) -> anyhow::Result<Option<Value>> {
        let actor_uuid = Self::parse_actor(actor_id)?;
        let guild_id = Uuid::parse_str(id).context("invalid guild id")?;
        let map = match payload {
            Value::Object(map) => map,
            Value::Null => serde_json::Map::new(),
            _ => bail!("guild payload must be an object"),
        };

        let mut client = self
            .pool
            .get()
            .await
            .context("acquire connection for update guild")?;
        let transaction = client
            .transaction()
            .await
            .context("begin transaction for update guild")?;
        let existing = transaction
            .query_opt(
                "SELECT id, owner_id, name, description, created_at FROM guilds WHERE id = $1 FOR UPDATE",
                &[&guild_id],
            )
            .await?;
        let Some(row) = existing else {
            return Ok(None);
        };
        let mut guild = Self::row_to_value(&row)?;
        let owner_id: Uuid = row.try_get("owner_id")?;
        if owner_id != actor_uuid {
            return Ok(None);
        }

        if let Some(value) = map.get("name") {
            let name = value
                .as_str()
                .ok_or_else(|| anyhow!("name must be a string"))?
                .trim()
                .to_string();
            if name.is_empty() {
                bail!("name must be a non-empty string");
            }
            guild["name"] = Value::String(name);
        }

        if let Some(description_change) = Self::extract_optional_text_update(&map, "description")? {
            match description_change {
                Some(description) if description.is_empty() => {
                    guild["description"] = Value::Null;
                }
                Some(description) => {
                    guild["description"] = Value::String(description);
                }
                None => {
                    guild["description"] = Value::Null;
                }
            }
        }

        let name = guild
            .get("name")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("name missing after update merge"))?
            .to_string();
        let description_param: Option<String> = match guild.get("description") {
            Some(Value::String(value)) => Some(value.clone()),
            Some(Value::Null) | None => None,
            _ => None,
        };
        let description_ref: Option<&str> = description_param.as_deref();
        let row = transaction
            .query_one(
                "UPDATE guilds \
                 SET name = $2, description = $3 \
                 WHERE id = $1 \
                 RETURNING id, owner_id, name, description, created_at",
                &[&guild_id, &name, &description_ref],
            )
            .await?;
        transaction
            .commit()
            .await
            .context("commit update guild transaction")?;
        Ok(Some(Self::row_to_value(&row)?))
    }

    async fn delete(&self, actor_id: &str, id: &str) -> anyhow::Result<bool> {
        let actor_uuid = Self::parse_actor(actor_id)?;
        let guild_id = Uuid::parse_str(id).context("invalid guild id")?;
        let client = self
            .pool
            .get()
            .await
            .context("acquire connection for delete guild")?;
        let deleted = client
            .execute(
                "DELETE FROM guilds WHERE id = $1 AND owner_id = $2",
                &[&guild_id, &actor_uuid],
            )
            .await?;
        Ok(deleted > 0)
    }
}
