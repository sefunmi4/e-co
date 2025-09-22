use crate::error::AgentError;
use crate::proto::symbolcast::{symbol_cast_client::SymbolCastClient, Gesture, PointerEvent};
use async_trait::async_trait;
use std::sync::Arc;
use tokio_stream::iter;
use tonic::transport::{Channel, Endpoint};
use tonic::Request;

#[async_trait]
pub trait SymbolCastInvoker: Send + Sync + 'static {
    async fn recognize(&self, events: Vec<PointerEvent>) -> Result<Gesture, AgentError>;
}

#[derive(Clone)]
pub struct GrpcSymbolCastInvoker {
    endpoint: Endpoint,
}

impl GrpcSymbolCastInvoker {
    pub async fn connect(url: String) -> Result<Self, AgentError> {
        let endpoint = Endpoint::from_shared(url)
            .map_err(|err| AgentError::InvalidConfig(format!("invalid SYMBOLCAST_URL: {err}")))?;
        Ok(Self { endpoint })
    }

    async fn client(&self) -> Result<SymbolCastClient<Channel>, AgentError> {
        let channel = self.endpoint.clone().connect().await?;
        Ok(SymbolCastClient::new(channel))
    }
}

#[async_trait]
impl SymbolCastInvoker for GrpcSymbolCastInvoker {
    async fn recognize(&self, events: Vec<PointerEvent>) -> Result<Gesture, AgentError> {
        let mut client = self.client().await?;
        let stream = iter(events.into_iter());
        let response = client.recognize(Request::new(stream)).await?.into_inner();
        Ok(response)
    }
}

#[derive(Clone, Default)]
pub struct MockSymbolCastInvoker {
    pub gesture: Arc<tokio::sync::Mutex<Option<Gesture>>>,
}

#[async_trait]
impl SymbolCastInvoker for MockSymbolCastInvoker {
    async fn recognize(&self, _events: Vec<PointerEvent>) -> Result<Gesture, AgentError> {
        self.gesture
            .lock()
            .await
            .clone()
            .ok_or_else(|| AgentError::SymbolCast("no gesture configured".to_string()))
    }
}
