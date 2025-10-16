use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;

use crate::{
    analytics::{
        queries::{
            aggregate_artifact_events, aggregate_pod_events, ArtifactEventBucket, Paginated,
            PodEventBucket,
        },
        TimeWindow,
    },
    state::AppState,
};

const DEFAULT_PAGE_SIZE: i64 = 50;
const MAX_PAGE_SIZE: i64 = 200;

type ApiResult<T> = Result<T, (StatusCode, &'static str)>;

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    #[serde(default)]
    pub window: Option<TimeWindow>,
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default)]
    pub page_size: Option<i64>,
}

#[derive(Debug, serde::Serialize)]
pub struct AnalyticsResponse<T> {
    pub data: Vec<T>,
    pub window: TimeWindow,
    pub page: i64,
    pub page_size: i64,
    pub has_more: bool,
}

pub async fn list_pod_analytics(
    State(state): State<Arc<AppState>>,
    Query(params): Query<AnalyticsQuery>,
) -> ApiResult<Json<AnalyticsResponse<PodEventBucket>>> {
    let (window, page, page_size) = normalize_params(params)?;
    let Paginated { items, has_more } = aggregate_pod_events(&state.db, window, page, page_size)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to load analytics",
            )
        })?;
    Ok(Json(AnalyticsResponse {
        data: items,
        window,
        page,
        page_size,
        has_more,
    }))
}

pub async fn list_artifact_analytics(
    State(state): State<Arc<AppState>>,
    Query(params): Query<AnalyticsQuery>,
) -> ApiResult<Json<AnalyticsResponse<ArtifactEventBucket>>> {
    let (window, page, page_size) = normalize_params(params)?;
    let Paginated { items, has_more } =
        aggregate_artifact_events(&state.db, window, page, page_size)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to load analytics",
                )
            })?;
    Ok(Json(AnalyticsResponse {
        data: items,
        window,
        page,
        page_size,
        has_more,
    }))
}

fn normalize_params(params: AnalyticsQuery) -> ApiResult<(TimeWindow, i64, i64)> {
    let window = params.window.unwrap_or_default();
    let page = params.page.unwrap_or(1);
    if page < 1 {
        return Err((StatusCode::BAD_REQUEST, "Page must be at least 1"));
    }
    let page_size = params.page_size.unwrap_or(DEFAULT_PAGE_SIZE);
    if page_size < 1 {
        return Err((StatusCode::BAD_REQUEST, "Page size must be at least 1"));
    }
    let page_size = page_size.min(MAX_PAGE_SIZE);
    Ok((window, page, page_size))
}
