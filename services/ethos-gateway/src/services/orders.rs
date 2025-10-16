use std::collections::HashMap;

use anyhow::{anyhow, Context};
use chrono::{DateTime, Utc};
use deadpool_postgres::{GenericClient, Pool};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio_postgres::{types::Json as PgJson, Row};
use uuid::Uuid;

use crate::{
    analytics::events::record_sale_events,
    services::artifacts::{self, CartDetail},
};

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
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderItemOption {
    pub id: Uuid,
    pub order_item_id: Uuid,
    pub option_id: Uuid,
    pub price_cents: i64,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
}

impl OrderItemOption {
    fn maybe_from_row(row: &Row) -> Result<Option<Self>, tokio_postgres::Error> {
        let option_id: Option<Uuid> = row.try_get("order_item_option_id")?;
        if let Some(option_id) = option_id {
            Ok(Some(Self {
                id: option_id,
                order_item_id: row.try_get("order_item_id")?,
                option_id: row.try_get("option_id")?,
                price_cents: row.try_get("option_price_cents")?,
                metadata: row.try_get("order_item_option_metadata")?,
                created_at: row.try_get("order_item_option_created_at")?,
            }))
        } else {
            Ok(None)
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderItemDetail {
    pub id: Uuid,
    pub order_id: Uuid,
    pub artifact_id: Uuid,
    pub variant_id: Uuid,
    pub quantity: i32,
    pub unit_price_cents: i64,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
    pub options: Vec<OrderItemOption>,
    pub subtotal_cents: i64,
}

impl OrderItemDetail {
    fn new(row: &Row) -> Result<Self, tokio_postgres::Error> {
        let quantity: i32 = row.try_get("quantity")?;
        let unit_price_cents: i64 = row.try_get("unit_price_cents")?;
        Ok(Self {
            id: row.try_get("order_item_id")?,
            order_id: row.try_get("order_id")?,
            artifact_id: row.try_get("artifact_id")?,
            variant_id: row.try_get("variant_id")?,
            quantity,
            unit_price_cents,
            metadata: row.try_get("order_item_metadata")?,
            created_at: row.try_get("order_item_created_at")?,
            options: Vec::new(),
            subtotal_cents: unit_price_cents * quantity as i64,
        })
    }

    fn recalc(&mut self) {
        let options_total: i64 = self.options.iter().map(|option| option.price_cents).sum();
        self.subtotal_cents = (self.unit_price_cents + options_total) * self.quantity as i64;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderDetail {
    pub order: Order,
    pub items: Vec<OrderItemDetail>,
}

pub async fn list_orders(pool: &Pool, user_id: Uuid) -> anyhow::Result<Vec<OrderDetail>> {
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
    let mut orders = Vec::with_capacity(rows.len());
    for row in rows {
        let order = Order::from_row(&row)?;
        let items = load_order_items(&client, order.id).await?;
        orders.push(OrderDetail { order, items });
    }
    Ok(orders)
}

pub async fn get_order(
    pool: &Pool,
    id: Uuid,
    user_id: Uuid,
) -> anyhow::Result<Option<OrderDetail>> {
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
    let Some(row) = row else {
        return Ok(None);
    };
    let order = Order::from_row(&row)?;
    let items = load_order_items(&client, order.id).await?;
    Ok(Some(OrderDetail { order, items }))
}

pub async fn checkout_order(
    pool: &Pool,
    user_id: Uuid,
    status: String,
    metadata: Value,
) -> anyhow::Result<OrderDetail> {
    let mut client = pool
        .get()
        .await
        .context("acquire connection for checkout_order")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for checkout_order")?;
    let cart = artifacts::load_cart_detail_for_user(&transaction, user_id, true)
        .await
        .context("load cart for checkout")?;
    let Some(cart) = cart else {
        return Err(anyhow!("Cart is empty"));
    };
    if cart.items.is_empty() {
        return Err(anyhow!("Cart is empty"));
    }
    let total_cents: i64 = cart.items.iter().map(|item| item.subtotal_cents).sum();
    let status = if status.trim().is_empty() {
        "pending".to_string()
    } else {
        status
    };
    let order_id = Uuid::new_v4();
    let stored_metadata = PgJson(metadata);
    let row = transaction
        .query_one(
            "INSERT INTO orders (id, user_id, status, total_cents, metadata) \
             VALUES ($1, $2, $3, $4, $5) \
             RETURNING id, user_id, status, total_cents, metadata, created_at, updated_at",
            &[&order_id, &user_id, &status, &total_cents, &stored_metadata],
        )
        .await?;
    let order = Order::from_row(&row)?;
    insert_order_items(&transaction, order.id, &cart).await?;
    artifacts::clear_cart_items(&transaction, cart.cart.id)
        .await
        .context("clear cart during checkout")?;
    let detail = load_order_detail(&transaction, order.id).await?;
    let Some(detail) = detail else {
        return Err(anyhow!("Failed to load order detail"));
    };
    record_sale_events(&transaction, &detail)
        .await
        .context("record sale events")?;
    transaction
        .commit()
        .await
        .context("commit checkout_order transaction")?;
    Ok(detail)
}

pub async fn update_order(
    pool: &Pool,
    id: Uuid,
    user_id: Uuid,
    mut changes: OrderChanges,
) -> anyhow::Result<Option<OrderDetail>> {
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
    if let Some(metadata) = changes.metadata.take() {
        order.metadata = metadata;
    }
    order.updated_at = Utc::now();
    let stored_metadata = PgJson(order.metadata.clone());
    let row = transaction
        .query_one(
            "UPDATE orders \
             SET status = $2, metadata = $3, updated_at = $4 \
             WHERE id = $1 \
             RETURNING id, user_id, status, total_cents, metadata, created_at, updated_at",
            &[
                &order.id,
                &order.status,
                &stored_metadata,
                &order.updated_at,
            ],
        )
        .await?;
    let order = Order::from_row(&row)?;
    let items = load_order_items(&transaction, order.id).await?;
    transaction
        .commit()
        .await
        .context("commit update_order transaction")?;
    Ok(Some(OrderDetail { order, items }))
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

async fn load_order_detail<C: GenericClient>(
    client: &C,
    order_id: Uuid,
) -> Result<Option<OrderDetail>, tokio_postgres::Error> {
    let row = client
        .query_opt(
            "SELECT id, user_id, status, total_cents, metadata, created_at, updated_at \
             FROM orders WHERE id = $1",
            &[&order_id],
        )
        .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let order = Order::from_row(&row)?;
    let items = load_order_items(client, order.id).await?;
    Ok(Some(OrderDetail { order, items }))
}

async fn load_order_items<C: GenericClient>(
    client: &C,
    order_id: Uuid,
) -> Result<Vec<OrderItemDetail>, tokio_postgres::Error> {
    let rows = client
        .query(
            "SELECT \
                oi.id AS order_item_id, \
                oi.order_id, \
                oi.artifact_id, \
                oi.variant_id, \
                oi.quantity, \
                oi.unit_price_cents, \
                oi.metadata AS order_item_metadata, \
                oi.created_at AS order_item_created_at, \
                oio.id AS order_item_option_id, \
                oio.option_id, \
                oio.price_cents AS option_price_cents, \
                oio.metadata AS order_item_option_metadata, \
                oio.created_at AS order_item_option_created_at \
             FROM order_items oi \
             LEFT JOIN order_item_options oio ON oio.order_item_id = oi.id \
             WHERE oi.order_id = $1 \
             ORDER BY oi.created_at ASC, oio.created_at ASC",
            &[&order_id],
        )
        .await?;
    collect_order_item_rows(rows)
}

async fn insert_order_items<C: GenericClient>(
    client: &C,
    order_id: Uuid,
    cart: &CartDetail,
) -> Result<(), tokio_postgres::Error> {
    for cart_item in &cart.items {
        let item_id = Uuid::new_v4();
        client
            .execute(
                "INSERT INTO order_items (id, order_id, artifact_id, variant_id, quantity, unit_price_cents, metadata) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7)",
                &[
                    &item_id,
                    &order_id,
                    &cart_item.variant.artifact_id,
                    &cart_item.variant.id,
                    &cart_item.item.quantity,
                    &cart_item.variant.price_cents,
                    &PgJson(cart_item.variant.metadata.clone()),
                ],
            )
            .await?;
        for option in &cart_item.options {
            let order_option_id = Uuid::new_v4();
            client
                .execute(
                    "INSERT INTO order_item_options (id, order_item_id, option_id, price_cents, metadata) \
                     VALUES ($1, $2, $3, $4, $5)",
                    &[
                        &order_option_id,
                        &item_id,
                        &option.id,
                        &option.price_cents,
                        &PgJson(option.metadata.clone()),
                    ],
                )
                .await?;
        }
    }
    Ok(())
}

fn collect_order_item_rows(rows: Vec<Row>) -> Result<Vec<OrderItemDetail>, tokio_postgres::Error> {
    let mut items: Vec<OrderItemDetail> = Vec::new();
    let mut index: HashMap<Uuid, usize> = HashMap::new();
    for row in rows {
        let item_id: Uuid = row.try_get("order_item_id")?;
        let entry_index = if let Some(&existing) = index.get(&item_id) {
            existing
        } else {
            let mut item = OrderItemDetail::new(&row)?;
            item.recalc();
            items.push(item);
            let idx = items.len() - 1;
            index.insert(item_id, idx);
            idx
        };
        if let Some(option) = OrderItemOption::maybe_from_row(&row)? {
            let detail = &mut items[entry_index];
            detail.options.push(option);
            detail.recalc();
        }
    }
    Ok(items)
}
