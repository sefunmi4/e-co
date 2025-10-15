use std::collections::{HashMap, HashSet};

use anyhow::{anyhow, Context};
use chrono::{DateTime, Utc};
use deadpool_postgres::{GenericClient, Pool};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio_postgres::{types::Json as PgJson, Row};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub artifact_type: String,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
}

impl Artifact {
    pub(crate) fn from_row(row: &Row) -> Result<Self, tokio_postgres::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            owner_id: row.try_get("owner_id")?,
            artifact_type: row.try_get("artifact_type")?,
            metadata: row.try_get("metadata")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

#[derive(Debug, Clone, Default)]
pub struct ArtifactChanges {
    pub artifact_type: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactVariant {
    pub id: Uuid,
    pub artifact_id: Uuid,
    pub name: String,
    pub price_cents: i64,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
}

impl ArtifactVariant {
    fn from_row(row: &Row) -> Result<Self, tokio_postgres::Error> {
        Ok(Self {
            id: row.try_get("variant_id")?,
            artifact_id: row.try_get("artifact_id")?,
            name: row.try_get("variant_name")?,
            price_cents: row.try_get("variant_price_cents")?,
            metadata: row.try_get("variant_metadata")?,
            created_at: row.try_get("variant_created_at")?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactVariantOption {
    pub id: Uuid,
    pub variant_id: Uuid,
    pub name: String,
    pub price_cents: i64,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
}

impl ArtifactVariantOption {
    fn from_row(row: &Row) -> Result<Self, tokio_postgres::Error> {
        Ok(Self {
            id: row.try_get("option_id")?,
            variant_id: row.try_get("variant_id")?,
            name: row.try_get("option_name")?,
            price_cents: row.try_get("option_price_cents")?,
            metadata: row.try_get("option_metadata")?,
            created_at: row.try_get("option_created_at")?,
        })
    }

    fn maybe_from_row(row: &Row) -> Result<Option<Self>, tokio_postgres::Error> {
        let option_id: Option<Uuid> = row.try_get("option_id")?;
        if let Some(option_id) = option_id {
            Ok(Some(Self {
                id: option_id,
                variant_id: row.try_get("variant_id")?,
                name: row.try_get("option_name")?,
                price_cents: row.try_get("option_price_cents")?,
                metadata: row.try_get("option_metadata")?,
                created_at: row.try_get("option_created_at")?,
            }))
        } else {
            Ok(None)
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactVariantDetail {
    pub variant: ArtifactVariant,
    pub options: Vec<ArtifactVariantOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewVariant {
    pub name: String,
    pub price_cents: i64,
    #[serde(default)]
    pub metadata: Value,
}

#[derive(Debug, Clone, Default)]
pub struct VariantChanges {
    pub name: Option<String>,
    pub price_cents: Option<i64>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewVariantOption {
    pub name: String,
    pub price_cents: i64,
    #[serde(default)]
    pub metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateVariantOption {
    pub name: Option<String>,
    pub price_cents: Option<i64>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cart {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Cart {
    fn from_row(row: &Row) -> Result<Self, tokio_postgres::Error> {
        Ok(Self {
            id: row.try_get("cart_id")?,
            user_id: row.try_get("cart_user_id")?,
            created_at: row.try_get("cart_created_at")?,
            updated_at: row.try_get("cart_updated_at")?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CartItem {
    pub id: Uuid,
    pub cart_id: Uuid,
    pub variant_id: Uuid,
    pub quantity: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl CartItem {
    fn from_row(row: &Row) -> Result<Self, tokio_postgres::Error> {
        Ok(Self {
            id: row.try_get("cart_item_id")?,
            cart_id: row.try_get("cart_id")?,
            variant_id: row.try_get("variant_id")?,
            quantity: row.try_get("quantity")?,
            created_at: row.try_get("cart_item_created_at")?,
            updated_at: row.try_get("cart_item_updated_at")?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CartItemDetail {
    pub item: CartItem,
    pub variant: ArtifactVariant,
    pub options: Vec<ArtifactVariantOption>,
    pub unit_price_cents: i64,
    pub subtotal_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CartDetail {
    pub cart: Cart,
    pub items: Vec<CartItemDetail>,
    pub total_cents: i64,
}

impl CartItemDetail {
    fn new(item: CartItem, variant: ArtifactVariant, options: Vec<ArtifactVariantOption>) -> Self {
        let options_total: i64 = options.iter().map(|option| option.price_cents).sum();
        let unit_price_cents = variant.price_cents + options_total;
        let subtotal_cents = unit_price_cents * item.quantity as i64;
        Self {
            item,
            variant,
            options,
            unit_price_cents,
            subtotal_cents,
        }
    }
}

impl CartDetail {
    fn new(cart: Cart, items: Vec<CartItemDetail>) -> Self {
        let total_cents = items.iter().map(|item| item.subtotal_cents).sum();
        Self {
            cart,
            items,
            total_cents,
        }
    }
}

pub async fn list_artifacts(
    pool: &Pool,
    owner_id: Option<Uuid>,
    artifact_type: Option<&str>,
) -> anyhow::Result<Vec<Artifact>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for list_artifacts")?;
    let rows = match (owner_id, artifact_type) {
        (Some(owner_id), Some(artifact_type)) => {
            client
                .query(
                    "SELECT id, owner_id, artifact_type, metadata, created_at \
                     FROM artifacts WHERE owner_id = $1 AND artifact_type = $2 \
                     ORDER BY created_at DESC",
                    &[&owner_id, &artifact_type],
                )
                .await?
        }
        (Some(owner_id), None) => {
            client
                .query(
                    "SELECT id, owner_id, artifact_type, metadata, created_at \
                     FROM artifacts WHERE owner_id = $1 ORDER BY created_at DESC",
                    &[&owner_id],
                )
                .await?
        }
        (None, Some(artifact_type)) => {
            client
                .query(
                    "SELECT id, owner_id, artifact_type, metadata, created_at \
                     FROM artifacts WHERE artifact_type = $1 ORDER BY created_at DESC",
                    &[&artifact_type],
                )
                .await?
        }
        (None, None) => {
            client
                .query(
                    "SELECT id, owner_id, artifact_type, metadata, created_at \
                     FROM artifacts ORDER BY created_at DESC",
                    &[],
                )
                .await?
        }
    };
    rows.into_iter()
        .map(|row| Artifact::from_row(&row).map_err(anyhow::Error::from))
        .collect()
}

pub async fn get_artifact(pool: &Pool, id: Uuid) -> anyhow::Result<Option<Artifact>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for get_artifact")?;
    let row = client
        .query_opt(
            "SELECT id, owner_id, artifact_type, metadata, created_at FROM artifacts WHERE id = $1",
            &[&id],
        )
        .await?;
    match row {
        Some(row) => Ok(Some(Artifact::from_row(&row)?)),
        None => Ok(None),
    }
}

pub async fn get_artifact_for_owner(
    pool: &Pool,
    id: Uuid,
    owner_id: Uuid,
) -> anyhow::Result<Option<Artifact>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for get_artifact_for_owner")?;
    let row = client
        .query_opt(
            "SELECT id, owner_id, artifact_type, metadata, created_at \
             FROM artifacts WHERE id = $1 AND owner_id = $2",
            &[&id, &owner_id],
        )
        .await?;
    match row {
        Some(row) => Ok(Some(Artifact::from_row(&row)?)),
        None => Ok(None),
    }
}

pub async fn create_artifact(
    pool: &Pool,
    owner_id: Uuid,
    artifact_type: String,
    metadata: Value,
) -> anyhow::Result<Artifact> {
    let client = pool
        .get()
        .await
        .context("acquire connection for create_artifact")?;
    let id = Uuid::new_v4();
    let stored_metadata = PgJson(metadata);
    let row = client
        .query_one(
            "INSERT INTO artifacts (id, owner_id, artifact_type, metadata) \
             VALUES ($1, $2, $3, $4) \
             RETURNING id, owner_id, artifact_type, metadata, created_at",
            &[&id, &owner_id, &artifact_type, &stored_metadata],
        )
        .await?;
    Artifact::from_row(&row).map_err(anyhow::Error::from)
}

pub async fn update_artifact(
    pool: &Pool,
    id: Uuid,
    owner_id: Uuid,
    mut changes: ArtifactChanges,
) -> anyhow::Result<Option<Artifact>> {
    let mut client = pool
        .get()
        .await
        .context("acquire connection for update_artifact")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for update_artifact")?;
    let row = transaction
        .query_opt(
            "SELECT id, owner_id, artifact_type, metadata, created_at \
             FROM artifacts WHERE id = $1 FOR UPDATE",
            &[&id],
        )
        .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let mut artifact = Artifact::from_row(&row)?;
    if artifact.owner_id != owner_id {
        return Ok(None);
    }
    if let Some(artifact_type) = changes.artifact_type.take() {
        artifact.artifact_type = artifact_type;
    }
    if let Some(metadata) = changes.metadata.take() {
        artifact.metadata = metadata;
    }
    let stored_metadata = PgJson(artifact.metadata.clone());
    let row = transaction
        .query_one(
            "UPDATE artifacts \
             SET artifact_type = $2, metadata = $3 \
             WHERE id = $1 \
             RETURNING id, owner_id, artifact_type, metadata, created_at",
            &[&artifact.id, &artifact.artifact_type, &stored_metadata],
        )
        .await?;
    transaction
        .commit()
        .await
        .context("commit update_artifact transaction")?;
    Artifact::from_row(&row)
        .map(Some)
        .map_err(anyhow::Error::from)
}

pub async fn delete_artifact(pool: &Pool, id: Uuid, owner_id: Uuid) -> anyhow::Result<bool> {
    let client = pool
        .get()
        .await
        .context("acquire connection for delete_artifact")?;
    let deleted = client
        .execute(
            "DELETE FROM artifacts WHERE id = $1 AND owner_id = $2",
            &[&id, &owner_id],
        )
        .await?;
    Ok(deleted > 0)
}

pub async fn list_artifact_variants(
    pool: &Pool,
    artifact_id: Uuid,
) -> anyhow::Result<Vec<ArtifactVariantDetail>> {
    let client = pool
        .get()
        .await
        .context("acquire connection for list_artifact_variants")?;
    load_variants_for_artifact(&client, artifact_id)
        .await
        .map_err(anyhow::Error::from)
}

pub async fn create_artifact_variant(
    pool: &Pool,
    artifact_id: Uuid,
    owner_id: Uuid,
    new_variant: NewVariant,
    options: Vec<NewVariantOption>,
) -> anyhow::Result<Option<ArtifactVariantDetail>> {
    if new_variant.name.trim().is_empty() {
        return Err(anyhow!("Variant name is required"));
    }
    if new_variant.price_cents < 0 {
        return Err(anyhow!("Variant price cannot be negative"));
    }
    for option in &options {
        if option.name.trim().is_empty() {
            return Err(anyhow!("Variant option name is required"));
        }
        if option.price_cents < 0 {
            return Err(anyhow!("Variant option price cannot be negative"));
        }
    }
    let mut client = pool
        .get()
        .await
        .context("acquire connection for create_artifact_variant")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for create_artifact_variant")?;
    let artifact_row = transaction
        .query_opt(
            "SELECT id FROM artifacts WHERE id = $1 AND owner_id = $2 FOR UPDATE",
            &[&artifact_id, &owner_id],
        )
        .await?;
    if artifact_row.is_none() {
        return Ok(None);
    }
    let variant_id = Uuid::new_v4();
    let variant_row = transaction
        .query_one(
            "INSERT INTO artifact_variants (id, artifact_id, name, price_cents, metadata) \
             VALUES ($1, $2, $3, $4, $5) \
             RETURNING \
                id AS variant_id, \
                artifact_id, \
                name AS variant_name, \
                price_cents AS variant_price_cents, \
                metadata AS variant_metadata, \
                created_at AS variant_created_at",
            &[
                &variant_id,
                &artifact_id,
                &new_variant.name,
                &new_variant.price_cents,
                &PgJson(new_variant.metadata),
            ],
        )
        .await?;
    for option in options {
        let option_id = Uuid::new_v4();
        transaction
            .execute(
                "INSERT INTO artifact_variant_options (id, variant_id, name, price_cents, metadata) \
                 VALUES ($1, $2, $3, $4, $5)",
                &[&option_id, &variant_id, &option.name, &option.price_cents, &PgJson(option.metadata)],
            )
            .await?;
    }
    let variant = ArtifactVariant::from_row(&variant_row)?;
    let detail = load_variant_detail(&transaction, variant.id).await?;
    transaction
        .commit()
        .await
        .context("commit create_artifact_variant transaction")?;
    Ok(detail)
}

pub async fn update_artifact_variant(
    pool: &Pool,
    artifact_id: Uuid,
    variant_id: Uuid,
    owner_id: Uuid,
    mut changes: VariantChanges,
) -> anyhow::Result<Option<ArtifactVariantDetail>> {
    if changes
        .name
        .as_ref()
        .map(|name| name.trim().is_empty())
        .unwrap_or(false)
    {
        return Err(anyhow!("Variant name cannot be empty"));
    }
    if changes.price_cents.map(|price| price < 0).unwrap_or(false) {
        return Err(anyhow!("Variant price cannot be negative"));
    }
    let mut client = pool
        .get()
        .await
        .context("acquire connection for update_artifact_variant")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for update_artifact_variant")?;
    let variant_row = transaction
        .query_opt(
            "SELECT \
                v.id AS variant_id, \
                v.artifact_id, \
                v.name AS variant_name, \
                v.price_cents AS variant_price_cents, \
                v.metadata AS variant_metadata, \
                v.created_at AS variant_created_at \
             FROM artifact_variants v \
             JOIN artifacts a ON a.id = v.artifact_id \
             WHERE v.id = $1 AND v.artifact_id = $2 AND a.owner_id = $3 \
             FOR UPDATE",
            &[&variant_id, &artifact_id, &owner_id],
        )
        .await?;
    let Some(row) = variant_row else {
        return Ok(None);
    };
    let mut variant = ArtifactVariant::from_row(&row)?;
    if let Some(name) = changes.name.take() {
        variant.name = name;
    }
    if let Some(price) = changes.price_cents.take() {
        variant.price_cents = price;
    }
    if let Some(metadata) = changes.metadata.take() {
        variant.metadata = metadata;
    }
    transaction
        .execute(
            "UPDATE artifact_variants \
             SET name = $2, price_cents = $3, metadata = $4 \
             WHERE id = $1",
            &[
                &variant.id,
                &variant.name,
                &variant.price_cents,
                &PgJson(variant.metadata.clone()),
            ],
        )
        .await?;
    let detail = load_variant_detail(&transaction, variant.id).await?;
    transaction
        .commit()
        .await
        .context("commit update_artifact_variant transaction")?;
    Ok(detail)
}

pub async fn delete_artifact_variant(
    pool: &Pool,
    artifact_id: Uuid,
    variant_id: Uuid,
    owner_id: Uuid,
) -> anyhow::Result<bool> {
    let client = pool
        .get()
        .await
        .context("acquire connection for delete_artifact_variant")?;
    let deleted = client
        .execute(
            "DELETE FROM artifact_variants v USING artifacts a \
             WHERE v.id = $1 AND v.artifact_id = $2 AND a.id = v.artifact_id AND a.owner_id = $3",
            &[&variant_id, &artifact_id, &owner_id],
        )
        .await?;
    Ok(deleted > 0)
}

pub async fn create_variant_option(
    pool: &Pool,
    artifact_id: Uuid,
    variant_id: Uuid,
    owner_id: Uuid,
    option: NewVariantOption,
) -> anyhow::Result<Option<ArtifactVariantOption>> {
    if option.name.trim().is_empty() {
        return Err(anyhow!("Variant option name is required"));
    }
    if option.price_cents < 0 {
        return Err(anyhow!("Variant option price cannot be negative"));
    }
    let mut client = pool
        .get()
        .await
        .context("acquire connection for create_variant_option")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for create_variant_option")?;
    let variant_row = transaction
        .query_opt(
            "SELECT v.id FROM artifact_variants v \
             JOIN artifacts a ON a.id = v.artifact_id \
             WHERE v.id = $1 AND v.artifact_id = $2 AND a.owner_id = $3 \
             FOR UPDATE",
            &[&variant_id, &artifact_id, &owner_id],
        )
        .await?;
    if variant_row.is_none() {
        return Ok(None);
    }
    let option_id = Uuid::new_v4();
    let row = transaction
        .query_one(
            "INSERT INTO artifact_variant_options (id, variant_id, name, price_cents, metadata) \
             VALUES ($1, $2, $3, $4, $5) \
             RETURNING \
                id AS option_id, \
                variant_id, \
                name AS option_name, \
                price_cents AS option_price_cents, \
                metadata AS option_metadata, \
                created_at AS option_created_at",
            &[
                &option_id,
                &variant_id,
                &option.name,
                &option.price_cents,
                &PgJson(option.metadata),
            ],
        )
        .await?;
    let option = ArtifactVariantOption::from_row(&row)?;
    transaction
        .commit()
        .await
        .context("commit create_variant_option transaction")?;
    Ok(Some(option))
}

pub async fn update_variant_option(
    pool: &Pool,
    artifact_id: Uuid,
    variant_id: Uuid,
    option_id: Uuid,
    owner_id: Uuid,
    changes: UpdateVariantOption,
) -> anyhow::Result<Option<ArtifactVariantOption>> {
    if changes
        .name
        .as_ref()
        .map(|name| name.trim().is_empty())
        .unwrap_or(false)
    {
        return Err(anyhow!("Variant option name cannot be empty"));
    }
    if changes.price_cents.map(|price| price < 0).unwrap_or(false) {
        return Err(anyhow!("Variant option price cannot be negative"));
    }
    let mut client = pool
        .get()
        .await
        .context("acquire connection for update_variant_option")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for update_variant_option")?;
    let row = transaction
        .query_opt(
            "SELECT \
                o.id AS option_id, \
                o.variant_id, \
                o.name AS option_name, \
                o.price_cents AS option_price_cents, \
                o.metadata AS option_metadata, \
                o.created_at AS option_created_at \
             FROM artifact_variant_options o \
             JOIN artifact_variants v ON v.id = o.variant_id \
             JOIN artifacts a ON a.id = v.artifact_id \
             WHERE o.id = $1 AND o.variant_id = $2 AND v.artifact_id = $3 AND a.owner_id = $4 \
             FOR UPDATE",
            &[&option_id, &variant_id, &artifact_id, &owner_id],
        )
        .await?;
    let Some(mut option) = row
        .map(|row| ArtifactVariantOption::from_row(&row))
        .transpose()?
    else {
        return Ok(None);
    };
    if let Some(name) = changes.name {
        option.name = name;
    }
    if let Some(price) = changes.price_cents {
        option.price_cents = price;
    }
    if let Some(metadata) = changes.metadata {
        option.metadata = metadata;
    }
    transaction
        .execute(
            "UPDATE artifact_variant_options \
             SET name = $2, price_cents = $3, metadata = $4 \
             WHERE id = $1",
            &[
                &option.id,
                &option.name,
                &option.price_cents,
                &PgJson(option.metadata.clone()),
            ],
        )
        .await?;
    transaction
        .commit()
        .await
        .context("commit update_variant_option transaction")?;
    Ok(Some(option))
}

pub async fn delete_variant_option(
    pool: &Pool,
    artifact_id: Uuid,
    variant_id: Uuid,
    option_id: Uuid,
    owner_id: Uuid,
) -> anyhow::Result<bool> {
    let client = pool
        .get()
        .await
        .context("acquire connection for delete_variant_option")?;
    let deleted = client
        .execute(
            "DELETE FROM artifact_variant_options o USING artifact_variants v, artifacts a \
             WHERE o.id = $1 \
             AND o.variant_id = $2 \
             AND v.id = o.variant_id \
             AND v.artifact_id = $3 \
             AND a.id = v.artifact_id \
             AND a.owner_id = $4",
            &[&option_id, &variant_id, &artifact_id, &owner_id],
        )
        .await?;
    Ok(deleted > 0)
}

async fn load_variant_detail<C: GenericClient>(
    client: &C,
    variant_id: Uuid,
) -> Result<Option<ArtifactVariantDetail>, tokio_postgres::Error> {
    let rows = client
        .query(
            "SELECT \
                v.id AS variant_id, \
                v.artifact_id, \
                v.name AS variant_name, \
                v.price_cents AS variant_price_cents, \
                v.metadata AS variant_metadata, \
                v.created_at AS variant_created_at, \
                o.id AS option_id, \
                o.name AS option_name, \
                o.price_cents AS option_price_cents, \
                o.metadata AS option_metadata, \
                o.created_at AS option_created_at \
             FROM artifact_variants v \
             LEFT JOIN artifact_variant_options o ON o.variant_id = v.id \
             WHERE v.id = $1 \
             ORDER BY o.created_at ASC",
            &[&variant_id],
        )
        .await?;
    let mut variants = collect_variant_rows(rows)?;
    Ok(variants.pop())
}

async fn load_variants_for_artifact<C: GenericClient>(
    client: &C,
    artifact_id: Uuid,
) -> Result<Vec<ArtifactVariantDetail>, tokio_postgres::Error> {
    let rows = client
        .query(
            "SELECT \
                v.id AS variant_id, \
                v.artifact_id, \
                v.name AS variant_name, \
                v.price_cents AS variant_price_cents, \
                v.metadata AS variant_metadata, \
                v.created_at AS variant_created_at, \
                o.id AS option_id, \
                o.name AS option_name, \
                o.price_cents AS option_price_cents, \
                o.metadata AS option_metadata, \
                o.created_at AS option_created_at \
             FROM artifact_variants v \
             LEFT JOIN artifact_variant_options o ON o.variant_id = v.id \
             WHERE v.artifact_id = $1 \
             ORDER BY v.created_at ASC, o.created_at ASC",
            &[&artifact_id],
        )
        .await?;
    collect_variant_rows(rows)
}

fn collect_variant_rows(
    rows: Vec<Row>,
) -> Result<Vec<ArtifactVariantDetail>, tokio_postgres::Error> {
    let mut variants: Vec<ArtifactVariantDetail> = Vec::new();
    let mut index: HashMap<Uuid, usize> = HashMap::new();
    for row in rows {
        let variant_id: Uuid = row.try_get("variant_id")?;
        let entry_index = if let Some(&existing) = index.get(&variant_id) {
            existing
        } else {
            let variant = ArtifactVariant::from_row(&row)?;
            variants.push(ArtifactVariantDetail {
                variant,
                options: Vec::new(),
            });
            let idx = variants.len() - 1;
            index.insert(variant_id, idx);
            idx
        };
        if let Some(option) = ArtifactVariantOption::maybe_from_row(&row)? {
            variants[entry_index].options.push(option);
        }
    }
    Ok(variants)
}

pub async fn get_cart(pool: &Pool, user_id: Uuid) -> anyhow::Result<CartDetail> {
    let mut client = pool
        .get()
        .await
        .context("acquire connection for get_cart")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for get_cart")?;
    let cart = get_or_create_cart(&transaction, user_id).await?;
    let detail = load_cart_detail_from_cart(&transaction, cart).await?;
    transaction
        .commit()
        .await
        .context("commit get_cart transaction")?;
    Ok(detail)
}

pub async fn add_cart_item(
    pool: &Pool,
    user_id: Uuid,
    variant_id: Uuid,
    quantity: i32,
    option_ids: Vec<Uuid>,
) -> anyhow::Result<CartDetail> {
    if quantity <= 0 {
        return Err(anyhow!("Quantity must be greater than zero"));
    }
    validate_option_ids(&option_ids)?;
    let mut client = pool
        .get()
        .await
        .context("acquire connection for add_cart_item")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for add_cart_item")?;
    let cart = get_or_create_cart(&transaction, user_id).await?;
    ensure_variant_exists(&transaction, variant_id).await?;
    ensure_option_ownership(&transaction, variant_id, &option_ids).await?;
    let item_row = transaction
        .query_opt(
            "SELECT \
                id AS cart_item_id, \
                cart_id, \
                variant_id, \
                quantity, \
                created_at AS cart_item_created_at, \
                updated_at AS cart_item_updated_at \
             FROM cart_items \
             WHERE cart_id = $1 AND variant_id = $2 \
             FOR UPDATE",
            &[&cart.id, &variant_id],
        )
        .await?;
    let item_id = if let Some(row) = item_row {
        let item = CartItem::from_row(&row)?;
        transaction
            .execute(
                "UPDATE cart_items SET quantity = $2, updated_at = NOW() WHERE id = $1",
                &[&item.id, &quantity],
            )
            .await?;
        item.id
    } else {
        let item_id = Uuid::new_v4();
        transaction
            .execute(
                "INSERT INTO cart_items (id, cart_id, variant_id, quantity) VALUES ($1, $2, $3, $4)",
                &[&item_id, &cart.id, &variant_id, &quantity],
            )
            .await?;
        item_id
    };
    transaction
        .execute(
            "DELETE FROM cart_item_options WHERE cart_item_id = $1",
            &[&item_id],
        )
        .await?;
    for option_id in option_ids {
        transaction
            .execute(
                "INSERT INTO cart_item_options (cart_item_id, option_id) VALUES ($1, $2)",
                &[&item_id, &option_id],
            )
            .await?;
    }
    update_cart_timestamp(&transaction, cart.id).await?;
    let detail = load_cart_detail_from_cart(&transaction, cart).await?;
    transaction
        .commit()
        .await
        .context("commit add_cart_item transaction")?;
    Ok(detail)
}

pub async fn update_cart_item(
    pool: &Pool,
    user_id: Uuid,
    cart_item_id: Uuid,
    quantity: Option<i32>,
    option_ids: Option<Vec<Uuid>>,
) -> anyhow::Result<Option<CartDetail>> {
    if let Some(quantity) = quantity {
        if quantity <= 0 {
            return Err(anyhow!("Quantity must be greater than zero"));
        }
    }
    if let Some(ids) = option_ids.as_ref() {
        validate_option_ids(ids)?;
    }
    let mut client = pool
        .get()
        .await
        .context("acquire connection for update_cart_item")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for update_cart_item")?;
    let Some(cart) = select_cart_row(&transaction, user_id, true).await? else {
        transaction
            .commit()
            .await
            .context("commit update_cart_item transaction")?;
        return Ok(None);
    };
    let item_row = transaction
        .query_opt(
            "SELECT \
                id AS cart_item_id, \
                cart_id, \
                variant_id, \
                quantity, \
                created_at AS cart_item_created_at, \
                updated_at AS cart_item_updated_at \
             FROM cart_items \
             WHERE id = $1 AND cart_id = $2 \
             FOR UPDATE",
            &[&cart_item_id, &cart.id],
        )
        .await?;
    let Some(item_row) = item_row else {
        transaction
            .commit()
            .await
            .context("commit update_cart_item transaction")?;
        return Ok(None);
    };
    let item = CartItem::from_row(&item_row)?;
    if let Some(ids) = option_ids.as_ref() {
        ensure_option_ownership(&transaction, item.variant_id, ids).await?;
    }
    if let Some(quantity) = quantity {
        transaction
            .execute(
                "UPDATE cart_items SET quantity = $2, updated_at = NOW() WHERE id = $1",
                &[&item.id, &quantity],
            )
            .await?;
    } else {
        transaction
            .execute(
                "UPDATE cart_items SET updated_at = NOW() WHERE id = $1",
                &[&item.id],
            )
            .await?;
    }
    if let Some(ids) = option_ids {
        transaction
            .execute(
                "DELETE FROM cart_item_options WHERE cart_item_id = $1",
                &[&item.id],
            )
            .await?;
        for option_id in ids {
            transaction
                .execute(
                    "INSERT INTO cart_item_options (cart_item_id, option_id) VALUES ($1, $2)",
                    &[&item.id, &option_id],
                )
                .await?;
        }
    }
    update_cart_timestamp(&transaction, cart.id).await?;
    let detail = load_cart_detail_from_cart(&transaction, cart).await?;
    transaction
        .commit()
        .await
        .context("commit update_cart_item transaction")?;
    Ok(Some(detail))
}

pub async fn remove_cart_item(
    pool: &Pool,
    user_id: Uuid,
    cart_item_id: Uuid,
) -> anyhow::Result<CartDetail> {
    let mut client = pool
        .get()
        .await
        .context("acquire connection for remove_cart_item")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for remove_cart_item")?;
    let cart = get_or_create_cart(&transaction, user_id).await?;
    transaction
        .execute(
            "DELETE FROM cart_items WHERE id = $1 AND cart_id = $2",
            &[&cart_item_id, &cart.id],
        )
        .await?;
    update_cart_timestamp(&transaction, cart.id).await?;
    let detail = load_cart_detail_from_cart(&transaction, cart).await?;
    transaction
        .commit()
        .await
        .context("commit remove_cart_item transaction")?;
    Ok(detail)
}

pub async fn clear_cart(pool: &Pool, user_id: Uuid) -> anyhow::Result<()> {
    let mut client = pool
        .get()
        .await
        .context("acquire connection for clear_cart")?;
    let transaction = client
        .transaction()
        .await
        .context("begin transaction for clear_cart")?;
    if let Some(cart) = select_cart_row(&transaction, user_id, true).await? {
        clear_cart_items(&transaction, cart.id).await?;
    }
    transaction
        .commit()
        .await
        .context("commit clear_cart transaction")?;
    Ok(())
}

pub(crate) async fn load_cart_detail_for_user<C: GenericClient>(
    client: &C,
    user_id: Uuid,
    lock: bool,
) -> anyhow::Result<Option<CartDetail>> {
    let cart = select_cart_row(client, user_id, lock).await?;
    match cart {
        Some(cart) => {
            let detail = load_cart_detail_from_cart(client, cart).await?;
            Ok(Some(detail))
        }
        None => Ok(None),
    }
}

async fn get_or_create_cart<C: GenericClient>(
    client: &C,
    user_id: Uuid,
) -> Result<Cart, tokio_postgres::Error> {
    if let Some(cart) = select_cart_row(client, user_id, true).await? {
        Ok(cart)
    } else {
        insert_cart_row(client, user_id).await
    }
}

async fn select_cart_row<C: GenericClient>(
    client: &C,
    user_id: Uuid,
    lock: bool,
) -> Result<Option<Cart>, tokio_postgres::Error> {
    let query = if lock {
        "SELECT id AS cart_id, user_id AS cart_user_id, created_at AS cart_created_at, updated_at AS cart_updated_at FROM carts WHERE user_id = $1 FOR UPDATE"
    } else {
        "SELECT id AS cart_id, user_id AS cart_user_id, created_at AS cart_created_at, updated_at AS cart_updated_at FROM carts WHERE user_id = $1"
    };
    let row = client.query_opt(query, &[&user_id]).await?;
    row.map(|row| Cart::from_row(&row)).transpose()
}

async fn insert_cart_row<C: GenericClient>(
    client: &C,
    user_id: Uuid,
) -> Result<Cart, tokio_postgres::Error> {
    let cart_id = Uuid::new_v4();
    let row = client
        .query_one(
            "INSERT INTO carts (id, user_id) VALUES ($1, $2) \
             RETURNING id AS cart_id, user_id AS cart_user_id, created_at AS cart_created_at, updated_at AS cart_updated_at",
            &[&cart_id, &user_id],
        )
        .await?;
    Cart::from_row(&row)
}

async fn load_cart_detail_from_cart<C: GenericClient>(
    client: &C,
    cart: Cart,
) -> Result<CartDetail, tokio_postgres::Error> {
    let items = load_cart_items(client, cart.id).await?;
    Ok(CartDetail::new(cart, items))
}

async fn load_cart_items<C: GenericClient>(
    client: &C,
    cart_id: Uuid,
) -> Result<Vec<CartItemDetail>, tokio_postgres::Error> {
    let rows = client
        .query(
            "SELECT \
                ci.id AS cart_item_id, \
                ci.cart_id, \
                ci.variant_id, \
                ci.quantity, \
                ci.created_at AS cart_item_created_at, \
                ci.updated_at AS cart_item_updated_at, \
                v.id AS variant_id, \
                v.artifact_id, \
                v.name AS variant_name, \
                v.price_cents AS variant_price_cents, \
                v.metadata AS variant_metadata, \
                v.created_at AS variant_created_at, \
                o.id AS option_id, \
                o.name AS option_name, \
                o.price_cents AS option_price_cents, \
                o.metadata AS option_metadata, \
                o.created_at AS option_created_at \
             FROM cart_items ci \
             JOIN artifact_variants v ON v.id = ci.variant_id \
             LEFT JOIN cart_item_options cio ON cio.cart_item_id = ci.id \
             LEFT JOIN artifact_variant_options o ON o.id = cio.option_id \
             WHERE ci.cart_id = $1 \
             ORDER BY ci.created_at ASC, o.created_at ASC",
            &[&cart_id],
        )
        .await?;
    let mut items: Vec<CartItemDetail> = Vec::new();
    let mut index: HashMap<Uuid, usize> = HashMap::new();
    for row in rows {
        let item_id: Uuid = row.try_get("cart_item_id")?;
        let entry_index = if let Some(&existing) = index.get(&item_id) {
            existing
        } else {
            let item = CartItem::from_row(&row)?;
            let variant = ArtifactVariant::from_row(&row)?;
            items.push(CartItemDetail::new(item, variant, Vec::new()));
            let idx = items.len() - 1;
            index.insert(item_id, idx);
            idx
        };
        if let Some(option) = ArtifactVariantOption::maybe_from_row(&row)? {
            let detail = &mut items[entry_index];
            detail.options.push(option);
            let options_total: i64 = detail.options.iter().map(|opt| opt.price_cents).sum();
            detail.unit_price_cents = detail.variant.price_cents + options_total;
            detail.subtotal_cents = detail.unit_price_cents * detail.item.quantity as i64;
        }
    }
    Ok(items)
}

async fn update_cart_timestamp<C: GenericClient>(
    client: &C,
    cart_id: Uuid,
) -> Result<(), tokio_postgres::Error> {
    client
        .execute(
            "UPDATE carts SET updated_at = NOW() WHERE id = $1",
            &[&cart_id],
        )
        .await?;
    Ok(())
}

pub(crate) async fn clear_cart_items<C: GenericClient>(
    client: &C,
    cart_id: Uuid,
) -> Result<(), tokio_postgres::Error> {
    client
        .execute("DELETE FROM cart_items WHERE cart_id = $1", &[&cart_id])
        .await?;
    update_cart_timestamp(client, cart_id).await
}

async fn ensure_variant_exists<C: GenericClient>(
    client: &C,
    variant_id: Uuid,
) -> anyhow::Result<()> {
    let exists = client
        .query_opt(
            "SELECT 1 FROM artifact_variants WHERE id = $1",
            &[&variant_id],
        )
        .await?;
    if exists.is_some() {
        Ok(())
    } else {
        Err(anyhow!("Variant not found"))
    }
}

async fn ensure_option_ownership<C: GenericClient>(
    client: &C,
    variant_id: Uuid,
    option_ids: &[Uuid],
) -> anyhow::Result<()> {
    if option_ids.is_empty() {
        return Ok(());
    }
    let rows = client
        .query(
            "SELECT id FROM artifact_variant_options WHERE variant_id = $1 AND id = ANY($2)",
            &[&variant_id, &option_ids],
        )
        .await?;
    if rows.len() == option_ids.len() {
        Ok(())
    } else {
        Err(anyhow!("Invalid variant option selection"))
    }
}

fn validate_option_ids(option_ids: &[Uuid]) -> anyhow::Result<()> {
    let mut seen = HashSet::new();
    for option_id in option_ids {
        if !seen.insert(*option_id) {
            return Err(anyhow!("Duplicate option identifier provided"));
        }
    }
    Ok(())
}
