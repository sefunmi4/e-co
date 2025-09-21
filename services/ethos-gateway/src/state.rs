use std::sync::Arc;

use crate::{
    config::GatewayConfig,
    matrix::MatrixBridge,
    services::{EventPublisher, RoomService},
};

#[derive(Clone)]
pub struct AppState {
    pub config: GatewayConfig,
    pub room_service: Arc<dyn RoomService>,
    pub publisher: Arc<dyn EventPublisher>,
    pub matrix: Arc<dyn MatrixBridge>,
}

impl AppState {
    pub fn new(
        config: GatewayConfig,
        room_service: Arc<dyn RoomService>,
        publisher: Arc<dyn EventPublisher>,
        matrix: Arc<dyn MatrixBridge>,
    ) -> Self {
        Self {
            config,
            room_service,
            publisher,
            matrix,
        }
    }
}
