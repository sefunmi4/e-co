use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionLink {
    pub token: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PresenceSnapshot {
    pub participants: usize,
}

#[derive(Default)]
pub struct PresenceServer;

impl PresenceServer {
    pub async fn invite(&self, _pod_id: Option<String>) -> Result<SessionLink> {
        Ok(SessionLink {
            token: Uuid::new_v4().to_string(),
        })
    }

    pub async fn join(&self, _link: SessionLink) -> Result<PresenceSnapshot> {
        Ok(PresenceSnapshot { participants: 2 })
    }
}
