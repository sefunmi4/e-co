use anyhow::Context;
use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio_postgres::{types::Json as PgJson, Row};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: Uuid,
    pub user_id: Uuid,
    pub status: String,
    pub total_cents: i64,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Order {
    pub(crate) fn from_row(row: &Row) -> Result<Self, tokio_postgres::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            user_id: row.try_get("user_id")?,
            status: row.try_get("status")?,
            total_cents: row.try_get("total_cents")?,
            metadata: row.try_get("metadata")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

#[derive(Debug, Clone, Default)]
pub struct OrderChanges {
    pub status: Option<String>,
    pub total_cents: Option<i64>,
    pub metadata: Option<Value>,
}

pub async fn list_orders(pool: &Pool, user_id: Uuid) -> anyhow::Result<Vec<Order>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for list_orders")?;
    let rows = client
        .query(
            "SELECT id, user_id, status, total_cents, metadata, created_at, updated_at \
             FROM orders WHERE user_id = $1 ORDER BY created_at DESC",
            &[&user_id],
        )
        .await?;
    rows.into_iter()
        .map(|row| Order::from_row(&row).map_err(anyhow::Error::from))
        .collect()
}

pub async fn get_order(pool: &Pool, id: Uuid, user_id: Uuid) -> anyhow::Result<Option<Order>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for get_order")?;
    let row = client
        .query_opt(
            "SELECT id, user_id, status, total_cents, metadata, created_at, updated_at \
             FROM orders WHERE id = $1 AND user_id = $2",
            &[&id, &user_id],
        )
        .await?;
    match row {
        Some(row) => Ok(Some(Order::from_row(&row)?)),
        None => Ok(None),
    }
}

pub async fn create_order(
    pool: &Pool,
    user_id: Uuid,
    status: String,
    total_cents: i64,
    metadata: Value,
) -> anyhow::Result<Order> {
    let client = pool
        .get()
        .await
        .context("acquire connection for create_order")?;
    let id = Uuid::new_v4();
    let stored_metadata = PgJson(metadata);
    let row = client
        .query_one(
            "INSERT INTO orders (id, user_id, status, total_cents, metadata) \
             VALUES ($1, $2, $3, $4, $5) \
             RETURNING id, user_id, status, total_cents, metadata, created_at, updated_at",
            &[&id, &user_id, &status, &total_cents, &stored_metadata],
        )
        .await?;
    Order::from_row(&row).map_err(anyhow::Error::from)
}

pub async fn update_order(
    pool: &Pool,
    id: Uuid,
    user_id: Uuid,
    mut changes: OrderChanges,
) -> anyhow::Result<Option<Order>> {
    let mut client = pool
        .get()
        .await
        .context("acquire connection for update_order")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for update_order")?;
    let row = transaction
        .query_opt(
            "SELECT id, user_id, status, total_cents, metadata, created_at, updated_at \
             FROM orders WHERE id = $1 FOR UPDATE",
            &[&id],
        )
        .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let mut order = Order::from_row(&row)?;
    if order.user_id != user_id {
        return Ok(None);
    }
    if let Some(status) = changes.status.take() {
        order.status = status;
    }
    if let Some(total_cents) = changes.total_cents.take() {
        order.total_cents = total_cents;
    }
    if let Some(metadata) = changes.metadata.take() {
        order.metadata = metadata;
    }
    order.updated_at = Utc::now();
    let stored_metadata = PgJson(order.metadata.clone());
    let row = transaction
        .query_one(
            "UPDATE orders \
             SET status = $2, total_cents = $3, metadata = $4, updated_at = $5 \
             WHERE id = $1 \
             RETURNING id, user_id, status, total_cents, metadata, created_at, updated_at",
            &[
                &order.id,
                &order.status,
                &order.total_cents,
                &stored_metadata,
                &order.updated_at,
            ],
        )
        .await?;
    transaction
        .commit()
        .await
        .context("commit update_order transaction")?;
    Order::from_row(&row).map(Some).map_err(anyhow::Error::from)
}

pub async fn delete_order(pool: &Pool, id: Uuid, user_id: Uuid) -> anyhow::Result<bool> {
    let client = pool
        .get()
        .await
        .context("acquire connection for delete_order")?;
    let deleted = client
        .execute(
            "DELETE FROM orders WHERE id = $1 AND user_id = $2",
            &[&id, &user_id],
        )
        .await?;
    Ok(deleted > 0)
}
