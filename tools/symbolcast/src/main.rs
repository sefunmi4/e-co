use symbolcastd::{server, SymbolCastService};
use tonic::transport::Server;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    let addr: std::net::SocketAddr = std::env::var("SYMBOLCASTD_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:50061".to_string())
        .parse()?;
    let service = SymbolCastService::new().await;
    info!(%addr, "symbolcastd mock listening");
    Server::builder()
        .add_service(server(service))
        .serve(addr)
        .await?;
    Ok(())
}
