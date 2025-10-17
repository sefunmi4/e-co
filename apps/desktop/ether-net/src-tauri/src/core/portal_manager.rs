use anyhow::Result;

#[derive(Clone, Debug, Default)]
pub struct WorldHandle {
    pub slug: String,
}

#[derive(Default)]
pub struct PortalManager;

impl PortalManager {
    pub fn new() -> Self {
        Self
    }

    pub async fn load_world(&self, slug: &str) -> Result<WorldHandle> {
        Ok(WorldHandle {
            slug: slug.to_string(),
        })
    }

    pub async fn set_active(&self, _handle: &WorldHandle) -> Result<()> {
        Ok(())
    }
}
