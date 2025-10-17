use anyhow::Result;
use parking_lot::Mutex;

use super::portal_manager::{PortalManager, WorldHandle};

#[derive(Default)]
pub struct TeleportRouter {
    portal_manager: PortalManager,
    history: Mutex<Vec<WorldHandle>>,
}

impl TeleportRouter {
    pub fn new() -> Self {
        Self {
            portal_manager: PortalManager::new(),
            history: Mutex::new(Vec::new()),
        }
    }

    pub async fn teleport_to(&self, slug: String) -> Result<()> {
        let handle = self.portal_manager.load_world(&slug).await?;
        self.portal_manager.set_active(&handle).await?;
        self.history.lock().push(handle);
        Ok(())
    }

    pub fn history(&self) -> Vec<String> {
        self.history
            .lock()
            .iter()
            .map(|handle| handle.slug.clone())
            .collect()
    }
}
