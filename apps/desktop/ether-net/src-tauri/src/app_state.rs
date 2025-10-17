use crate::core::search_indexer::WorldIndex;

#[derive(Default)]
pub struct AppState {
    pub owner_pod_id: Option<String>,
    pub eco_api_url: String,
    pub gateway_url: String,
    pub index: WorldIndex,
}

impl AppState {
    pub fn new(eco_api_url: String, gateway_url: String) -> Self {
        Self {
            owner_pod_id: None,
            eco_api_url,
            gateway_url,
            index: WorldIndex::default(),
        }
    }
}
