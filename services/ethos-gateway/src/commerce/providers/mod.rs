mod models;
pub mod printify;
pub mod shopify;

pub use printify::PrintifyProvider;
pub use shopify::ShopifyProvider;

use async_trait::async_trait;
pub use models::{
    Catalog, CatalogItem, CatalogOption, CatalogVariant, Fulfillment, FulfillmentStatus,
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProviderError {
    #[error("failed to parse fixture '{fixture}': {source}")]
    Parse {
        fixture: &'static str,
        #[source]
        source: serde_json::Error,
    },
    #[error("unsupported status value: {0}")]
    UnsupportedStatus(String),
}

impl ProviderError {
    pub fn parse(fixture: &'static str, source: serde_json::Error) -> Self {
        Self::Parse { fixture, source }
    }
}

#[async_trait]
pub trait CommerceProvider: Send + Sync {
    fn name(&self) -> &'static str;

    async fn catalog(&self) -> Result<Catalog, ProviderError>;

    async fn fulfillments(&self) -> Result<Vec<Fulfillment>, ProviderError>;
}
