use serde::Deserialize;
use thiserror::Error;
use tracing::info;
use futures::StreamExt;

#[derive(Debug, Error)]
enum AgentError {
    #[error("nats error: {0}")]
    Nats(#[from] async_nats::Error),
    #[error("failed to parse command: {0}")]
    Serde(#[from] serde_json::Error),
}

#[derive(Debug, Deserialize)]
struct GestureCommand {
    id: String,
    label: String,
}

#[tokio::main]
async fn main() -> Result<(), AgentError> {
    tracing_subscriber::fmt::init();
    let client = async_nats::connect("nats://127.0.0.1:4222").await?;
    info!("eco-agent connected to NATS");
    let mut sub = client.subscribe("eco.gesture.detected").await?;

    while let Some(msg) = sub.next().await {
        let cmd: GestureCommand = serde_json::from_slice(&msg.payload)?;
        info!(?cmd, "received gesture");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn agent_error_display() {
        let err = AgentError::Serde(serde_json::from_str::<GestureCommand>("{}").unwrap_err());
        assert!(err.to_string().contains("failed to parse"));
    }
}
