use std::sync::Arc;

use crate::{
    app_state::AppState,
    core::{
        artifact_drive::{ArtifactVisibility, DriveUpdateResult},
        presence_server::{PresenceSnapshot, SessionLink},
        search_indexer::{SearchIndexer, WorldCard},
        teleport_router::TeleportRouter,
    },
};
use parking_lot::Mutex;
use tauri::State;

#[tauri::command]
pub async fn search_worlds(
    query: String,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<WorldCard>, String> {
    let eco_api_url = { state.lock().eco_api_url.clone() };

    let mut guard = state.lock();
    SearchIndexer::new(eco_api_url)
        .search(&query, &mut guard.index)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn teleport_to(
    slug: String,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<(), String> {
    let router = TeleportRouter::new();
    router.teleport_to(slug).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_artifact_visibility(
    artifact_id: String,
    visibility: ArtifactVisibility,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<DriveUpdateResult, String> {
    let gateway_url = state.lock().gateway_url.clone();
    crate::core::artifact_drive::ArtifactDrive::new(gateway_url)
        .set_visibility(&artifact_id, visibility)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn invite_friend(state: State<'_, Arc<Mutex<AppState>>>) -> Result<SessionLink, String> {
    let state = state.lock();
    crate::core::presence_server::PresenceServer::default()
        .invite(state.owner_pod_id.clone())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn join_session(link: SessionLink) -> Result<PresenceSnapshot, String> {
    crate::core::presence_server::PresenceServer::default()
        .join(link)
        .await
        .map_err(|e| e.to_string())
}
