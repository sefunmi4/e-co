use super::{
    Catalog, CatalogItem, CatalogOption, CatalogVariant, CommerceProvider, Fulfillment,
    FulfillmentStatus, ProviderError,
};
use async_trait::async_trait;
use serde::Deserialize;

const CATALOG_FIXTURE: &str = include_str!("../../../test/fixtures/shopify/catalog.json");
const FULFILLMENT_FIXTURE: &str = include_str!("../../../test/fixtures/shopify/fulfillments.json");

#[derive(Debug, Default)]
pub struct ShopifyProvider;

#[async_trait]
impl CommerceProvider for ShopifyProvider {
    fn name(&self) -> &'static str {
        "shopify"
    }

    async fn catalog(&self) -> Result<Catalog, ProviderError> {
        let parsed: ShopifyCatalog = serde_json::from_str(CATALOG_FIXTURE)
            .map_err(|err| ProviderError::parse("shopify/catalog.json", err))?;

        let items = parsed
            .products
            .into_iter()
            .map(|product| CatalogItem {
                id: product.id,
                title: product.title,
                description: product.body_html,
                tags: product
                    .tags
                    .split(',')
                    .map(|tag| tag.trim().to_string())
                    .filter(|tag| !tag.is_empty())
                    .collect(),
                variants: product
                    .variants
                    .into_iter()
                    .map(|variant| CatalogVariant {
                        id: variant.id,
                        sku: variant.sku,
                        price_cents: normalize_price(&variant.price),
                        currency: variant.currency,
                        options: variant
                            .option_values
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
        let parsed: ShopifyFulfillments = serde_json::from_str(FULFILLMENT_FIXTURE)
            .map_err(|err| ProviderError::parse("shopify/fulfillments.json", err))?;

        parsed
            .fulfillments
            .into_iter()
            .map(|fulfillment| -> Result<Fulfillment, ProviderError> {
                let status = map_status(fulfillment.status)?;
                Ok(Fulfillment {
                    id: fulfillment.id,
                    order_id: fulfillment.order_id,
                    status,
                    tracking_numbers: fulfillment.tracking_numbers,
                    estimated_delivery: fulfillment.estimated_delivery_at,
                })
            })
            .collect()
    }
}

fn normalize_price(price: &str) -> u32 {
    let cleaned = price.trim();
    if let Some((whole, fractional)) = cleaned.split_once('.') {
        let mut cents: String = fractional.chars().take(2).collect();
        while cents.len() < 2 {
            cents.push('0');
        }
        let whole: u32 = whole.parse().unwrap_or(0);
        let cents: u32 = cents.parse().unwrap_or(0);
        whole * 100 + cents
    } else {
        cleaned.parse::<u32>().unwrap_or(0) * 100
    }
}

fn map_status(value: String) -> Result<FulfillmentStatus, ProviderError> {
    match value.as_str() {
        "open" => Ok(FulfillmentStatus::Pending),
        "in_progress" => Ok(FulfillmentStatus::InProduction),
        "success" | "shipped" => Ok(FulfillmentStatus::Shipped),
        "delivered" => Ok(FulfillmentStatus::Delivered),
        "cancelled" => Ok(FulfillmentStatus::Cancelled),
        other => Err(ProviderError::UnsupportedStatus(other.to_string())),
    }
}

#[derive(Debug, Deserialize)]
struct ShopifyCatalog {
    products: Vec<ShopifyProduct>,
}

#[derive(Debug, Deserialize)]
struct ShopifyProduct {
    id: String,
    title: String,
    #[serde(rename = "body_html")]
    body_html: Option<String>,
    tags: String,
    variants: Vec<ShopifyVariant>,
}

#[derive(Debug, Deserialize)]
struct ShopifyVariant {
    id: String,
    sku: String,
    price: String,
    #[serde(default = "default_currency")]
    currency: String,
    #[serde(rename = "options")]
    option_values: Vec<ShopifyOption>,
}

#[derive(Debug, Deserialize)]
struct ShopifyOption {
    name: String,
    value: String,
}

#[derive(Debug, Deserialize)]
struct ShopifyFulfillments {
    fulfillments: Vec<ShopifyFulfillment>,
}

#[derive(Debug, Deserialize)]
struct ShopifyFulfillment {
    id: String,
    order_id: String,
    status: String,
    tracking_numbers: Vec<String>,
    #[serde(rename = "estimated_delivery_at")]
    estimated_delivery_at: Option<String>,
}

fn default_currency() -> String {
    "USD".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn it_maps_catalog_fixture() {
        let provider = ShopifyProvider::default();
        let catalog = provider.catalog().await.expect("catalog should parse");

        assert_eq!(catalog.items.len(), 1);
        let poster = &catalog.items[0];
        assert_eq!(poster.title, "Generative Poster Series");
        assert_eq!(poster.variants.len(), 3);
        assert_eq!(poster.tags, vec!["poster", "art", "limited"]);
        assert_eq!(poster.variants[1].price_cents, 4000);
    }

    #[tokio::test]
    async fn it_maps_fulfillment_fixture() {
        let provider = ShopifyProvider::default();
        let fulfillments = provider
            .fulfillments()
            .await
            .expect("fulfillments should parse");

        assert_eq!(fulfillments.len(), 2);
        assert_eq!(fulfillments[0].status, FulfillmentStatus::Shipped);
        assert_eq!(fulfillments[1].status, FulfillmentStatus::Delivered);
        assert_eq!(fulfillments[0].tracking_numbers[0], "1Z999AA10123456784");
    }
}
