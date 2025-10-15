use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use anyhow::Error;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{
    auth::AuthSession,
    services::artifacts::{
        self, Artifact, ArtifactChanges, ArtifactVariantDetail, ArtifactVariantOption, CartDetail,
        NewVariant, NewVariantOption, UpdateVariantOption, VariantChanges,
    },
    state::AppState,
};

type ApiResult<T> = Result<T, (StatusCode, &'static str)>;

#[derive(Debug, Deserialize)]
pub struct CreateArtifactRequest {
    pub artifact_type: String,
    #[serde(default = "default_metadata")]
    pub metadata: Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateArtifactRequest {
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct ArtifactDetail {
    pub artifact: Artifact,
    pub variants: Vec<ArtifactVariantDetail>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVariantRequest {
    pub name: String,
    pub price_cents: i64,
    #[serde(default = "default_metadata")]
    pub metadata: Value,
    #[serde(default)]
    pub options: Vec<CreateVariantOptionRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVariantOptionRequest {
    pub name: String,
    pub price_cents: i64,
    #[serde(default = "default_metadata")]
    pub metadata: Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVariantRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub price_cents: Option<i64>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVariantOptionRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub price_cents: Option<i64>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct AddCartItemRequest {
    pub variant_id: Uuid,
    #[serde(default = "default_quantity")]
    pub quantity: i32,
    #[serde(default)]
    pub option_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCartItemRequest {
    #[serde(default)]
    pub quantity: Option<i32>,
    #[serde(default)]
    pub option_ids: Option<Vec<Uuid>>,
}

pub async fn list_artifacts(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> ApiResult<Json<Vec<Artifact>>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_type = params.get("artifact_type").map(String::as_str);
    let artifacts = artifacts::list_artifacts(&state.db, Some(owner_id), artifact_type)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to list artifacts",
            )
        })?;
    Ok(Json(artifacts))
}

pub async fn create_artifact(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateArtifactRequest>,
) -> ApiResult<(StatusCode, Json<Artifact>)> {
    let owner_id = parse_uuid(&auth.user_id)?;
    if body.artifact_type.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Artifact type is required"));
    }
    let artifact =
        artifacts::create_artifact(&state.db, owner_id, body.artifact_type, body.metadata)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to create artifact",
                )
            })?;
    Ok((StatusCode::CREATED, Json(artifact)))
}

pub async fn get_artifact(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(artifact_id): Path<String>,
) -> ApiResult<Json<ArtifactDetail>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    let artifact = artifacts::get_artifact_for_owner(&state.db, artifact_id, owner_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load artifact"))?;
    match artifact {
        Some(artifact) => {
            let variants = artifacts::list_artifact_variants(&state.db, artifact.id)
                .await
                .map_err(|_| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "Failed to list artifact variants",
                    )
                })?;
            Ok(Json(ArtifactDetail { artifact, variants }))
        }
        None => Err((StatusCode::NOT_FOUND, "Artifact not found")),
    }
}

pub async fn update_artifact(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(artifact_id): Path<String>,
    Json(body): Json<UpdateArtifactRequest>,
) -> ApiResult<Json<Artifact>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    if body
        .artifact_type
        .as_ref()
        .map(|value| value.trim().is_empty())
        .unwrap_or(false)
    {
        return Err((StatusCode::BAD_REQUEST, "Artifact type cannot be empty"));
    }
    let changes = ArtifactChanges {
        artifact_type: body.artifact_type,
        metadata: body.metadata,
    };
    let updated = artifacts::update_artifact(&state.db, artifact_id, owner_id, changes)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to update artifact",
            )
        })?;
    match updated {
        Some(artifact) => Ok(Json(artifact)),
        None => Err((StatusCode::NOT_FOUND, "Artifact not found")),
    }
}

pub async fn delete_artifact(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(artifact_id): Path<String>,
) -> ApiResult<StatusCode> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    let deleted = artifacts::delete_artifact(&state.db, artifact_id, owner_id)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to delete artifact",
            )
        })?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Artifact not found"))
    }
}

pub async fn list_artifact_variants(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(artifact_id): Path<String>,
) -> ApiResult<Json<Vec<ArtifactVariantDetail>>> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    let artifact_exists = artifacts::get_artifact_for_owner(&state.db, artifact_id, owner_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load artifact"))?;
    if artifact_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Artifact not found"));
    }
    let variants = artifacts::list_artifact_variants(&state.db, artifact_id)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to list artifact variants",
            )
        })?;
    Ok(Json(variants))
}

pub async fn create_artifact_variant(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(artifact_id): Path<String>,
    Json(body): Json<CreateVariantRequest>,
) -> ApiResult<(StatusCode, Json<ArtifactVariantDetail>)> {
    if body.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Variant name is required"));
    }
    if body.price_cents < 0 {
        return Err((StatusCode::BAD_REQUEST, "Variant price cannot be negative"));
    }
    for option in &body.options {
        if option.name.trim().is_empty() {
            return Err((StatusCode::BAD_REQUEST, "Variant option name is required"));
        }
        if option.price_cents < 0 {
            return Err((
                StatusCode::BAD_REQUEST,
                "Variant option price cannot be negative",
            ));
        }
    }
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    let new_variant = NewVariant {
        name: body.name,
        price_cents: body.price_cents,
        metadata: body.metadata,
    };
    let options: Vec<NewVariantOption> = body
        .options
        .into_iter()
        .map(|option| NewVariantOption {
            name: option.name,
            price_cents: option.price_cents,
            metadata: option.metadata,
        })
        .collect();
    match artifacts::create_artifact_variant(&state.db, artifact_id, owner_id, new_variant, options)
        .await
    {
        Ok(Some(detail)) => Ok((StatusCode::CREATED, Json(detail))),
        Ok(None) => Err((StatusCode::NOT_FOUND, "Artifact not found")),
        Err(_) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to create artifact variant",
        )),
    }
}

pub async fn update_artifact_variant(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path((artifact_id, variant_id)): Path<(String, String)>,
    Json(body): Json<UpdateVariantRequest>,
) -> ApiResult<Json<ArtifactVariantDetail>> {
    if body
        .name
        .as_ref()
        .map(|name| name.trim().is_empty())
        .unwrap_or(false)
    {
        return Err((StatusCode::BAD_REQUEST, "Variant name cannot be empty"));
    }
    if body.price_cents.map(|price| price < 0).unwrap_or(false) {
        return Err((StatusCode::BAD_REQUEST, "Variant price cannot be negative"));
    }
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    let variant_id = parse_uuid(&variant_id)?;
    let changes = VariantChanges {
        name: body.name,
        price_cents: body.price_cents,
        metadata: body.metadata,
    };
    let updated =
        artifacts::update_artifact_variant(&state.db, artifact_id, variant_id, owner_id, changes)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to update artifact variant",
                )
            })?;
    match updated {
        Some(detail) => Ok(Json(detail)),
        None => Err((StatusCode::NOT_FOUND, "Artifact variant not found")),
    }
}

pub async fn delete_artifact_variant(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path((artifact_id, variant_id)): Path<(String, String)>,
) -> ApiResult<StatusCode> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    let variant_id = parse_uuid(&variant_id)?;
    let deleted = artifacts::delete_artifact_variant(&state.db, artifact_id, variant_id, owner_id)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to delete artifact variant",
            )
        })?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Artifact variant not found"))
    }
}

pub async fn create_variant_option(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path((artifact_id, variant_id)): Path<(String, String)>,
    Json(body): Json<CreateVariantOptionRequest>,
) -> ApiResult<(StatusCode, Json<ArtifactVariantOption>)> {
    if body.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Variant option name is required"));
    }
    if body.price_cents < 0 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Variant option price cannot be negative",
        ));
    }
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    let variant_id = parse_uuid(&variant_id)?;
    let option = NewVariantOption {
        name: body.name,
        price_cents: body.price_cents,
        metadata: body.metadata,
    };
    match artifacts::create_variant_option(&state.db, artifact_id, variant_id, owner_id, option)
        .await
    {
        Ok(Some(option)) => Ok((StatusCode::CREATED, Json(option))),
        Ok(None) => Err((StatusCode::NOT_FOUND, "Artifact variant not found")),
        Err(_) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to create variant option",
        )),
    }
}

pub async fn update_variant_option(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path((artifact_id, variant_id, option_id)): Path<(String, String, String)>,
    Json(body): Json<UpdateVariantOptionRequest>,
) -> ApiResult<Json<ArtifactVariantOption>> {
    if body
        .name
        .as_ref()
        .map(|name| name.trim().is_empty())
        .unwrap_or(false)
    {
        return Err((
            StatusCode::BAD_REQUEST,
            "Variant option name cannot be empty",
        ));
    }
    if body.price_cents.map(|price| price < 0).unwrap_or(false) {
        return Err((
            StatusCode::BAD_REQUEST,
            "Variant option price cannot be negative",
        ));
    }
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    let variant_id = parse_uuid(&variant_id)?;
    let option_id = parse_uuid(&option_id)?;
    let changes = UpdateVariantOption {
        name: body.name,
        price_cents: body.price_cents,
        metadata: body.metadata,
    };
    let updated = artifacts::update_variant_option(
        &state.db,
        artifact_id,
        variant_id,
        option_id,
        owner_id,
        changes,
    )
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to update variant option",
        )
    })?;
    match updated {
        Some(option) => Ok(Json(option)),
        None => Err((StatusCode::NOT_FOUND, "Variant option not found")),
    }
}

pub async fn delete_variant_option(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path((artifact_id, variant_id, option_id)): Path<(String, String, String)>,
) -> ApiResult<StatusCode> {
    let owner_id = parse_uuid(&auth.user_id)?;
    let artifact_id = parse_uuid(&artifact_id)?;
    let variant_id = parse_uuid(&variant_id)?;
    let option_id = parse_uuid(&option_id)?;
    let deleted =
        artifacts::delete_variant_option(&state.db, artifact_id, variant_id, option_id, owner_id)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to delete variant option",
                )
            })?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Variant option not found"))
    }
}

pub async fn get_cart(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<CartDetail>> {
    let user_id = parse_uuid(&auth.user_id)?;
    let cart = artifacts::get_cart(&state.db, user_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load cart"))?;
    Ok(Json(cart))
}

pub async fn add_cart_item(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Json(body): Json<AddCartItemRequest>,
) -> ApiResult<(StatusCode, Json<CartDetail>)> {
    if body.quantity <= 0 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Quantity must be greater than zero",
        ));
    }
    ensure_unique_ids(&body.option_ids)?;
    let user_id = parse_uuid(&auth.user_id)?;
    match artifacts::add_cart_item(
        &state.db,
        user_id,
        body.variant_id,
        body.quantity,
        body.option_ids,
    )
    .await
    {
        Ok(cart) => Ok((StatusCode::CREATED, Json(cart))),
        Err(err) => Err(map_cart_error(err)),
    }
}

pub async fn update_cart_item(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(item_id): Path<String>,
    Json(body): Json<UpdateCartItemRequest>,
) -> ApiResult<Json<CartDetail>> {
    if body.quantity.map(|quantity| quantity <= 0).unwrap_or(false) {
        return Err((
            StatusCode::BAD_REQUEST,
            "Quantity must be greater than zero",
        ));
    }
    if let Some(ref option_ids) = body.option_ids {
        ensure_unique_ids(option_ids)?;
    }
    let UpdateCartItemRequest {
        quantity,
        option_ids,
    } = body;
    let user_id = parse_uuid(&auth.user_id)?;
    let item_id = parse_uuid(&item_id)?;
    match artifacts::update_cart_item(&state.db, user_id, item_id, quantity, option_ids).await {
        Ok(Some(cart)) => Ok(Json(cart)),
        Ok(None) => Err((StatusCode::NOT_FOUND, "Cart item not found")),
        Err(err) => Err(map_cart_error(err)),
    }
}

pub async fn delete_cart_item(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(item_id): Path<String>,
) -> ApiResult<Json<CartDetail>> {
    let user_id = parse_uuid(&auth.user_id)?;
    let item_id = parse_uuid(&item_id)?;
    match artifacts::remove_cart_item(&state.db, user_id, item_id).await {
        Ok(cart) => Ok(Json(cart)),
        Err(err) => Err(map_cart_error(err)),
    }
}

fn parse_uuid(value: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(value).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid identifier"))
}

fn ensure_unique_ids(ids: &[Uuid]) -> ApiResult<()> {
    let mut seen = HashSet::new();
    for id in ids {
        if !seen.insert(*id) {
            return Err((
                StatusCode::BAD_REQUEST,
                "Duplicate option identifier provided",
            ));
        }
    }
    Ok(())
}

fn map_cart_error(err: Error) -> (StatusCode, &'static str) {
    let message = err.to_string();
    if message.contains("Variant not found") {
        (StatusCode::NOT_FOUND, "Variant not found")
    } else if message.contains("Invalid variant option selection") {
        (StatusCode::BAD_REQUEST, "Invalid variant option selection")
    } else if message.contains("Duplicate option identifier provided") {
        (
            StatusCode::BAD_REQUEST,
            "Duplicate option identifier provided",
        )
    } else if message.contains("Quantity must be greater than zero") {
        (
            StatusCode::BAD_REQUEST,
            "Quantity must be greater than zero",
        )
    } else {
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update cart")
    }
}

fn default_metadata() -> Value {
    Value::Object(serde_json::Map::new())
}

fn default_quantity() -> i32 {
    1
}
