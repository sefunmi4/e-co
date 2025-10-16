# Commerce Providers

The Ethos gateway exposes a thin abstraction over third-party commerce providers. Each adapter conforms to the `CommerceProvider` trait and maps provider specific responses into a normalized catalog and fulfillment shape that the rest of the gateway can consume.

```rust
use ethos_gateway::commerce::providers::{CommerceProvider, PrintifyProvider, ShopifyProvider};

async fn load_demo_catalogs() -> anyhow::Result<()> {
    let printify = PrintifyProvider::default();
    let shopify = ShopifyProvider::default();

    let printify_catalog = printify.catalog().await?;
    let shopify_catalog = shopify.catalog().await?;

    println!("Printify carries {} items", printify_catalog.items.len());
    println!("Shopify carries {} items", shopify_catalog.items.len());

    Ok(())
}
```

## Normalized structures

Adapters emit the following normalized data structures:

- `Catalog` → contains a list of `CatalogItem` entries. Each item exposes its variants with currency normalized to cents to simplify price calculations.
- `Fulfillment` → captures an order level view with a unified `FulfillmentStatus` enum.

## Fixtures

Mock responses live under `services/ethos-gateway/test/fixtures`. The adapters read these fixtures to provide deterministic catalog and fulfillment results during local development and testing. New providers should follow the same pattern so the fixture data can double as documentation for the expected payload shape.
