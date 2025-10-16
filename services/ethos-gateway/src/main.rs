use std::sync::Arc;

use anyhow::Context;
use axum::Router;
use deadpool_postgres::Config as PgConfig;
use ethos_gateway::{
    analytics::PostgresAnalyticsSink,
    config::GatewayConfig,
    grpc,
    matrix::matrix_bridge_from_config,
    migrations::{run_demo_seed, run_migrations},
    router,
    services::{
        EventPublisher, GuildService, InMemoryRoomService, NatsPublisher, NoopPublisher,
        PostgresGuildService, PostgresQuestService, QuestService, RoomService,
    },
    state::AppState,
};
use tokio::{net::TcpListener, signal};
use tokio_postgres::NoTls;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let args: Vec<String> = std::env::args().collect();
    let command = args.get(1).map(|arg| arg.as_str());

    let config = GatewayConfig::from_env()?;
    tracing::info!(http = %config.http_addr, grpc = %config.grpc_addr, "starting ethos-gateway");

    let room_service: Arc<dyn RoomService> = Arc::new(InMemoryRoomService::new());

    let mut pg_config = PgConfig::new();
    pg_config.url = Some(config.database_url.clone());
    let db = pg_config
        .create_pool(None, NoTls)
        .context("failed to create postgres pool")?;
    run_migrations(&db).await?;

    if let Some("seed-demo-data") = command {
        run_demo_seed(&db).await?;
        tracing::info!("demo data seed complete");
        return Ok(());
    }
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
    let quest_service: Arc<dyn QuestService> =
        Arc::new(PostgresQuestService::new(db.clone(), publisher.clone()));
    let guild_service: Arc<dyn GuildService> = Arc::new(PostgresGuildService::new(db.clone()));
    let analytics = Arc::new(PostgresAnalyticsSink::new(db.clone()));

    let matrix = matrix_bridge_from_config(&config).await?;

    let app_state = AppState::new(
        config.clone(),
        db,
        room_service,
        publisher,
        matrix,
        quest_service,
        guild_service,
        analytics,
    );
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
