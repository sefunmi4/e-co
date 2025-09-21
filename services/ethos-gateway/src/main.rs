use std::sync::Arc;

use axum::Router;
use ethos_gateway::{
    config::GatewayConfig,
    grpc,
    matrix::matrix_bridge_from_config,
    router,
    services::{EventPublisher, InMemoryRoomService, NatsPublisher, NoopPublisher, RoomService},
    state::AppState,
};
use tokio::{net::TcpListener, signal};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let config = GatewayConfig::from_env()?;
    tracing::info!(http = %config.http_addr, grpc = %config.grpc_addr, "starting ethos-gateway");

    let room_service: Arc<dyn RoomService> = Arc::new(InMemoryRoomService::new());
    let publisher: Arc<dyn EventPublisher> = match &config.nats_url {
        Some(url) => match NatsPublisher::connect(url).await {
            Ok(client) => Arc::new(client),
            Err(error) => {
                tracing::warn!("failed to connect to NATS: {error}");
                Arc::new(NoopPublisher)
            }
        },
        None => Arc::new(NoopPublisher),
    };

    let matrix = matrix_bridge_from_config(&config).await?;

    let app_state = AppState::new(config.clone(), room_service, publisher, matrix);
    let http_router: Router = router(app_state.clone());
    let state = Arc::new(app_state);

    let http_listener = TcpListener::bind(config.http_addr).await?;
    let grpc_listener = TcpListener::bind(config.grpc_addr).await?;

    let http_server = axum::serve(http_listener, http_router.into_make_service())
        .with_graceful_shutdown(async {
            let _ = signal::ctrl_c().await;
            tracing::info!("received shutdown signal");
        });

    let grpc_server = grpc::serve(grpc_listener, state.clone());

    tokio::try_join!(
        async move { http_server.await.map_err(anyhow::Error::from) },
        grpc_server
    )?;

    Ok(())
}
