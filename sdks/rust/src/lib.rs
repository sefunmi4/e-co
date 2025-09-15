use eco_core::EcoManifest;
use serde::Serialize;

pub fn load_manifest_bytes(bytes: &[u8]) -> Result<EcoManifest, toml::de::Error> {
    toml::from_slice(bytes)
}

#[derive(Debug, Serialize)]
pub struct CastRequest<'a> {
    pub gesture: &'a str,
    pub target: &'a str,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_manifest() {
        let bytes = include_bytes!("../../examples/worlds/aurora/ECO.toml");
        let manifest = load_manifest_bytes(bytes).expect("manifest");
        assert_eq!(manifest.name, "Aurora Workspace");
    }
}
