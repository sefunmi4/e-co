use std::sync::Arc;

use crate::{
    config::GatewayConfig,
    matrix::MatrixBridge,
    services::{EventPublisher, GuildService, QuestService, RoomService},
};
use deadpool_postgres::Pool;

#[derive(Clone)]
pub struct AppState {
    pub config: GatewayConfig,
    pub db: Pool,
    pub room_service: Arc<dyn RoomService>,
    pub publisher: Arc<dyn EventPublisher>,
    pub matrix: Arc<dyn MatrixBridge>,
    pub quest_service: Arc<dyn QuestService>,
    pub guild_service: Arc<dyn GuildService>,
}

impl AppState {
    pub fn new(
        config: GatewayConfig,
        db: Pool,
        room_service: Arc<dyn RoomService>,
        publisher: Arc<dyn EventPublisher>,
        matrix: Arc<dyn MatrixBridge>,
        quest_service: Arc<dyn QuestService>,
        guild_service: Arc<dyn GuildService>,
    ) -> Self {
        Self {
            config,
            db,
            room_service,
            publisher,
            matrix,
            quest_service,
            guild_service,
        }
    }
}
