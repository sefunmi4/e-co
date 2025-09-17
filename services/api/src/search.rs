use std::path::{Path, PathBuf};

use eco_core::EcoManifest;
use glob::glob;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldCard {
    pub id: String,
    pub name: String,
    pub summary: String,
    pub entry_scene: String,
    pub portals: Vec<String>,
}

#[derive(Debug, Error)]
pub enum SearchError {
    #[error("manifest load failed: {0}")]
    Manifest(#[from] eco_core::manifest::ManifestError),
    #[error("glob pattern error: {0}")]
    Pattern(#[from] glob::PatternError),
    #[error("glob iteration error: {0}")]
    Glob(#[from] glob::GlobError),
}

impl SearchError {
    pub fn status_code(&self) -> axum::http::StatusCode {
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    }
}

#[derive(Clone)]
pub struct SearchIndex {
    cards: Vec<WorldCard>,
}

impl SearchIndex {
    pub fn bootstrap_from_examples() -> Result<Self, SearchError> {
        let base = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let pattern = base
            .join("../../examples/worlds/*/ECO.toml")
            .display()
            .to_string();

        let mut cards = Vec::new();
        for entry in glob(&pattern)? {
            let manifest_path = entry?;
            let manifest = EcoManifest::load_from_path(&manifest_path)?;
            let world_id = Self::infer_world_id(&manifest_path, &manifest);
            cards.push(WorldCard {
                id: world_id,
                name: manifest.name.clone(),
                summary: format!(
                    "{} v{} with {} portals",
                    manifest.name,
                    manifest.version,
                    manifest.portals.len()
                ),
                entry_scene: manifest.entry_scene.clone(),
                portals: manifest
                    .portals
                    .iter()
                    .map(|portal| portal.target.clone())
                    .collect(),
            });
        }

        Ok(Self { cards })
    }

    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<WorldCard>, SearchError> {
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }

        let needle = query.to_lowercase();
        let mut matches: Vec<(usize, WorldCard)> = self
            .cards
            .iter()
            .filter_map(|card| Self::score_card(card, &needle).map(|score| (score, card.clone())))
            .collect();

        matches.sort_by_key(|(score, card)| (*score, card.name.clone()));
        matches.truncate(limit);
        Ok(matches.into_iter().map(|(_, card)| card).collect())
    }

    fn score_card(card: &WorldCard, query: &str) -> Option<usize> {
        let mut best = usize::MAX;

        for field in [&card.name, &card.summary, &card.entry_scene] {
            if let Some(score) = Self::field_position(field, query) {
                best = best.min(score);
            }
        }

        for portal in &card.portals {
            if let Some(score) = Self::field_position(portal, query) {
                best = best.min(score + 1);
            }
        }

        if best == usize::MAX {
            None
        } else {
            Some(best)
        }
    }

    fn field_position(text: &str, query: &str) -> Option<usize> {
        let haystack = text.to_lowercase();
        haystack.find(query)
    }

    fn infer_world_id(path: &Path, manifest: &EcoManifest) -> String {
        path.parent()
            .and_then(|p| p.file_name())
            .and_then(|name| name.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| manifest.name.to_lowercase().replace(' ', "-"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_examples_into_index() {
        let index = SearchIndex::bootstrap_from_examples().expect("bootstrap search index");
        let results = index.search("Aurora", 5).expect("search results");
        assert!(results.iter().any(|card| card.id == "aurora"));
    }
}
