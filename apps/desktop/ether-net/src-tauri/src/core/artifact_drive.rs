use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum ArtifactVisibility {
    Private,
    Friends,
    Public,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ArtifactSummary {
    pub id: String,
    pub title: String,
    pub visibility: ArtifactVisibility,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DriveUpdateResult {
    pub artifact: ArtifactSummary,
}

#[derive(Clone)]
pub struct ArtifactDrive {
    gateway_url: String,
    client: reqwest::Client,
}

impl ArtifactDrive {
    pub fn new(gateway_url: String) -> Self {
        Self {
            gateway_url,
            client: reqwest::Client::new(),
        }
    }

    pub async fn list(&self) -> Result<Vec<ArtifactSummary>> {
        // Placeholder local scan. For now returns empty.
        Ok(vec![])
    }

    pub async fn set_visibility(
        &self,
        artifact_id: &str,
        visibility: ArtifactVisibility,
    ) -> Result<DriveUpdateResult> {
        let url = format!(
            "{}/api/artifacts/{}/visibility",
            self.gateway_url, artifact_id
        );
        let body = serde_json::json!({ "visibility": visibility });

        let response = self.client.patch(url).json(&body).send().await?;
        if !response.status().is_success() {
            return Err(anyhow!("gateway returned status {}", response.status()));
        }
        let artifact = ArtifactSummary {
            id: artifact_id.to_string(),
            title: String::new(),
            visibility,
        };
        Ok(DriveUpdateResult { artifact })
    }
}
