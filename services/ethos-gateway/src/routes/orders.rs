use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::{
    auth::AuthSession,
    services::orders::{self, OrderChanges, OrderDetail},
    state::AppState,
};

type ApiResult<T> = Result<T, (StatusCode, &'static str)>;

#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    #[serde(default = "default_order_status")]
    pub status: String,
    #[serde(default = "default_metadata")]
    pub metadata: Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrderRequest {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

pub async fn list_orders(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<Vec<OrderDetail>>> {
    let user_id = parse_uuid(&auth.user_id)?;
    let orders = orders::list_orders(&state.db, user_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list orders"))?;
    Ok(Json(orders))
}

pub async fn create_order(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateOrderRequest>,
) -> ApiResult<(StatusCode, Json<OrderDetail>)> {
    let user_id = parse_uuid(&auth.user_id)?;
    let status = if body.status.trim().is_empty() {
        default_order_status()
    } else {
        body.status
    };
    match orders::checkout_order(&state.db, user_id, status, body.metadata).await {
        Ok(order) => Ok((StatusCode::CREATED, Json(order))),
        Err(err) => {
            if err.to_string().contains("Cart is empty") {
                Err((StatusCode::BAD_REQUEST, "Cart is empty"))
            } else {
                Err((StatusCode::INTERNAL_SERVER_ERROR, "Failed to create order"))
            }
        }
    }
}

pub async fn get_order(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<String>,
) -> ApiResult<Json<OrderDetail>> {
    let user_id = parse_uuid(&auth.user_id)?;
    let order_id = parse_uuid(&order_id)?;
    let order = orders::get_order(&state.db, order_id, user_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load order"))?;
    match order {
        Some(order) => Ok(Json(order)),
        None => Err((StatusCode::NOT_FOUND, "Order not found")),
    }
}

pub async fn update_order(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<String>,
    Json(body): Json<UpdateOrderRequest>,
) -> ApiResult<Json<OrderDetail>> {
    let user_id = parse_uuid(&auth.user_id)?;
    let order_id = parse_uuid(&order_id)?;
    if body
        .status
        .as_ref()
        .map(|value| value.trim().is_empty())
        .unwrap_or(false)
    {
        return Err((StatusCode::BAD_REQUEST, "Order status cannot be empty"));
    }
    let changes = OrderChanges {
        status: body.status,
        metadata: body.metadata,
    };
    let updated = orders::update_order(&state.db, order_id, user_id, changes)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update order"))?;
    match updated {
        Some(order) => Ok(Json(order)),
        None => Err((StatusCode::NOT_FOUND, "Order not found")),
    }
}

pub async fn delete_order(
    auth: AuthSession,
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<String>,
) -> ApiResult<StatusCode> {
    let user_id = parse_uuid(&auth.user_id)?;
    let order_id = parse_uuid(&order_id)?;
    let deleted = orders::delete_order(&state.db, order_id, user_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete order"))?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Order not found"))
    }
}

fn parse_uuid(value: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(value).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid identifier"))
}

fn default_order_status() -> String {
    "pending".to_string()
}

fn default_metadata() -> Value {
    Value::Object(serde_json::Map::new())
}
