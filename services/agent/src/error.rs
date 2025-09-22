use thiserror::Error;

#[derive(Debug, Error)]
pub enum AgentError {
    #[error("nats error: {0}")]
    Nats(#[from] async_nats::Error),
    #[error("nats connection error: {0}")]
    Connect(#[from] async_nats::error::Error<async_nats::ConnectErrorKind>),
    #[error("nats subscribe error: {0}")]
    Subscribe(#[from] async_nats::SubscribeError),
    #[error("nats publish error: {0}")]
    Publish(#[from] async_nats::PublishError),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("gRPC transport error: {0}")]
    Transport(#[from] tonic::transport::Error),
    #[error("gRPC status: {0}")]
    Status(#[from] tonic::Status),
    #[error("invalid action: {0}")]
    InvalidAction(String),
    #[error("invalid configuration: {0}")]
    InvalidConfig(String),
    #[error("symbolcast error: {0}")]
    SymbolCast(String),
    #[error("quantum bridge error: {0}")]
    Bridge(#[from] cxx::Exception),
}
