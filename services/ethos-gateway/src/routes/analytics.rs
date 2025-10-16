use std::sync::Arc;

use axum::{extract::State, http::StatusCode, Json};
use tracing::warn;

use crate::{
    analytics::{AnalyticsEvent, EventOrigin},
    state::AppState,
};

type ApiResult<T> = Result<T, (StatusCode, &'static str)>;

pub async fn record_event(
    State(state): State<Arc<AppState>>,
    Json(event): Json<AnalyticsEvent>,
) -> ApiResult<StatusCode> {
    let mut event = event;
    ensure_origin(&mut event);
    if let Err(error) = state.analytics.record(event).await {
        warn!(%error, "failed to record analytics event");
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to record analytics event",
        ));
    }
    Ok(StatusCode::ACCEPTED)
}

fn ensure_origin(event: &mut AnalyticsEvent) {
    match event {
        AnalyticsEvent::PodEntered(inner) => inner.origin.get_or_insert(EventOrigin::Client),
        AnalyticsEvent::ArtifactViewed(inner) => inner.origin.get_or_insert(EventOrigin::Client),
        AnalyticsEvent::CheckoutStarted(inner) => inner.origin.get_or_insert(EventOrigin::Client),
        AnalyticsEvent::SaleRecorded(inner) => inner.origin.get_or_insert(EventOrigin::Client),
    };
}
