use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ManifestError {
    #[error("failed to read manifest: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to parse ECO manifest: {0}")]
    Parse(#[from] toml::de::Error),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PortalRef {
    pub id: String,
    pub target: String,
    #[serde(default)]
    pub kind: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComponentRef {
    pub id: String,
    pub service: String,
    #[serde(default)]
    pub transport: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SymbolCastConfig {
    pub model: Option<String>,
    #[serde(default)]
    pub threshold: Option<f32>,
    #[serde(default)]
    pub stream: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EcoManifest {
    pub name: String,
    pub version: String,
    pub entry_scene: String,
    #[serde(default)]
    pub portals: Vec<PortalRef>,
    #[serde(default)]
    pub components: Vec<ComponentRef>,
    #[serde(default)]
    pub symbolcast: SymbolCastConfig,
}

impl EcoManifest {
    pub fn load_from_path(path: impl AsRef<Path>) -> Result<Self, ManifestError> {
        let raw = fs::read_to_string(path)?;
        Ok(toml::from_str(&raw)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_manifest() {
        let raw = r#"
            name = "Aurora Hub"
            version = "0.1.0"
            entry_scene = "aurora.scene"

            [[portals]]
            id = "search"
            target = "eco.search://global"

            [[components]]
            id = "symbolcastd"
            service = "grpc://127.0.0.1:50061"

            [symbolcast]
            model = "symbolcast.onnx"
            threshold = 0.73
        "#;

        let manifest: EcoManifest = toml::from_str(raw).expect("parse manifest");
        assert_eq!(manifest.name, "Aurora Hub");
        assert_eq!(manifest.portals.len(), 1);
        assert_eq!(manifest.components.len(), 1);
        assert_eq!(manifest.symbolcast.threshold, Some(0.73));
    }
}
