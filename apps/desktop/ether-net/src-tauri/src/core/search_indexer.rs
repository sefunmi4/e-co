use std::collections::HashSet;

use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default)]
pub struct WorldIndex {
    pub worlds: Vec<WorldCard>,
}

impl WorldIndex {
    pub fn upsert(&mut self, cards: &[WorldCard]) {
        let mut seen: HashSet<String> = self.worlds.iter().map(|c| c.slug.clone()).collect();
        for card in cards {
            if seen.insert(card.slug.clone()) {
                self.worlds.push(card.clone());
            } else if let Some(existing) = self
                .worlds
                .iter_mut()
                .find(|existing| existing.slug == card.slug)
            {
                *existing = card.clone();
            }
        }
    }

    pub fn search(&self, query: &str) -> Vec<WorldCard> {
        let query = query.to_lowercase();
        self.worlds
            .iter()
            .filter(|card| card.title.to_lowercase().contains(&query))
            .cloned()
            .collect()
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorldCard {
    pub slug: String,
    pub title: String,
    pub owner: String,
}

pub struct SearchIndexer {
    eco_api_url: String,
    client: reqwest::Client,
}

impl SearchIndexer {
    pub fn new(eco_api_url: String) -> Self {
        Self {
            eco_api_url,
            client: reqwest::Client::new(),
        }
    }

    pub async fn search(&self, query: &str, index: &mut WorldIndex) -> Result<Vec<WorldCard>> {
        let remote = self.fetch_remote(query).await;

        match remote {
            Ok(cards) => {
                index.upsert(&cards);
                Ok(cards)
            }
            Err(error) => {
                log::warn!("remote search failed: {}", error);
                Ok(index.search(query))
            }
        }
    }

    async fn fetch_remote(&self, query: &str) -> Result<Vec<WorldCard>> {
        let url = format!(
            "{}/api/worlds/search?q={}",
            self.eco_api_url,
            urlencoding::encode(query)
        );

        let response = self.client.get(url).send().await?;
        let cards = response.json::<Vec<WorldCard>>().await?;
        Ok(cards)
    }
}
