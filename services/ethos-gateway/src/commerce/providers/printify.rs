use super::{
    Catalog, CatalogItem, CatalogOption, CatalogVariant, CommerceProvider, Fulfillment,
    FulfillmentStatus, ProviderError,
};
use async_trait::async_trait;
use serde::Deserialize;

const CATALOG_FIXTURE: &str = include_str!("../../../test/fixtures/printify/catalog.json");
const FULFILLMENT_FIXTURE: &str = include_str!("../../../test/fixtures/printify/fulfillments.json");

#[derive(Debug, Default)]
pub struct PrintifyProvider;

#[async_trait]
impl CommerceProvider for PrintifyProvider {
    fn name(&self) -> &'static str {
        "printify"
    }

    async fn catalog(&self) -> Result<Catalog, ProviderError> {
        let parsed: PrintifyCatalog = serde_json::from_str(CATALOG_FIXTURE)
            .map_err(|err| ProviderError::parse("printify/catalog.json", err))?;

        let items = parsed
            .data
            .into_iter()
            .map(|product| CatalogItem {
                id: product.id,
                title: product.title,
                description: product.description,
                tags: product.tags,
                variants: product
                    .variants
                    .into_iter()
                    .map(|variant| CatalogVariant {
                        id: variant.id,
                        sku: variant.sku,
                        price_cents: variant.price_cents,
                        currency: variant.currency,
                        options: variant
                            .options
                            .into_iter()
                            .map(|option| CatalogOption {
                                name: option.name,
                                value: option.value,
                            })
                            .collect(),
                    })
                    .collect(),
            })
            .collect();

        Ok(Catalog { items })
    }

    async fn fulfillments(&self) -> Result<Vec<Fulfillment>, ProviderError> {
        let parsed: PrintifyFulfillments = serde_json::from_str(FULFILLMENT_FIXTURE)
            .map_err(|err| ProviderError::parse("printify/fulfillments.json", err))?;

        parsed
            .fulfillments
            .into_iter()
            .map(|item| -> Result<Fulfillment, ProviderError> {
                let status = map_status(item.status)?;
                Ok(Fulfillment {
                    id: item.id,
                    order_id: item.order_id,
                    status,
                    tracking_numbers: item.tracking,
                    estimated_delivery: item.estimated_delivery,
                })
            })
            .collect()
    }
}

fn map_status(value: String) -> Result<FulfillmentStatus, ProviderError> {
    match value.as_str() {
        "pending" => Ok(FulfillmentStatus::Pending),
        "in_production" => Ok(FulfillmentStatus::InProduction),
        "shipped" => Ok(FulfillmentStatus::Shipped),
        "delivered" => Ok(FulfillmentStatus::Delivered),
        "cancelled" => Ok(FulfillmentStatus::Cancelled),
        other => Err(ProviderError::UnsupportedStatus(other.to_string())),
    }
}

#[derive(Debug, Deserialize)]
struct PrintifyCatalog {
    data: Vec<PrintifyProduct>,
}

#[derive(Debug, Deserialize)]
struct PrintifyProduct {
    id: String,
    title: String,
    description: Option<String>,
    tags: Vec<String>,
    variants: Vec<PrintifyVariant>,
}

#[derive(Debug, Deserialize)]
struct PrintifyVariant {
    id: String,
    sku: String,
    #[serde(rename = "price_cents")]
    price_cents: u32,
    currency: String,
    options: Vec<PrintifyOption>,
}

#[derive(Debug, Deserialize)]
struct PrintifyOption {
    name: String,
    value: String,
}

#[derive(Debug, Deserialize)]
struct PrintifyFulfillments {
    fulfillments: Vec<PrintifyFulfillment>,
}

#[derive(Debug, Deserialize)]
struct PrintifyFulfillment {
    id: String,
    order_id: String,
    status: String,
    tracking: Vec<String>,
    estimated_delivery: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn it_normalizes_catalog_from_fixture() {
        let provider = PrintifyProvider::default();
        let catalog = provider.catalog().await.expect("catalog should parse");

        assert_eq!(catalog.items.len(), 2);
        let hoodie = &catalog.items[0];
        assert_eq!(hoodie.title, "Holographic Hoodie");
        assert_eq!(hoodie.variants.len(), 2);
        assert_eq!(hoodie.variants[0].price_cents, 5500);
        assert_eq!(hoodie.variants[0].options[0].name, "Size");
    }

    #[tokio::test]
    async fn it_normalizes_fulfillment_from_fixture() {
        let provider = PrintifyProvider::default();
        let fulfillments = provider
            .fulfillments()
            .await
            .expect("fulfillments should parse");

        assert_eq!(fulfillments.len(), 2);
        assert_eq!(fulfillments[0].status, FulfillmentStatus::InProduction);
        assert_eq!(fulfillments[1].tracking_numbers.len(), 1);
        assert_eq!(
            fulfillments[1].estimated_delivery.as_deref(),
            Some("2024-07-14")
        );
    }
}
