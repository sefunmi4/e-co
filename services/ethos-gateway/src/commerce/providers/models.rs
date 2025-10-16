use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Catalog {
    pub items: Vec<CatalogItem>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CatalogItem {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub variants: Vec<CatalogVariant>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CatalogVariant {
    pub id: String,
    pub sku: String,
    pub price_cents: u32,
    pub currency: String,
    pub options: Vec<CatalogOption>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CatalogOption {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Fulfillment {
    pub id: String,
    pub order_id: String,
    pub status: FulfillmentStatus,
    pub tracking_numbers: Vec<String>,
    pub estimated_delivery: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FulfillmentStatus {
    Pending,
    InProduction,
    Shipped,
    Delivered,
    Cancelled,
}
