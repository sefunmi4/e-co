use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::Value;
use tantivy::schema::{Facet, FacetOptions, Field, Schema, STORED, STRING, TEXT};
use tantivy::{Document, Index, IndexWriter};
use tokio::sync::Mutex;
use tokio_postgres::{Client, NoTls};
use tracing::{error, info, warn};

const POD_SNAPSHOT_TYPE: &str = "pod_snapshot";
const DEFAULT_INDEX_PATH: &str = "./.tmp/index";
const DEFAULT_REFRESH_SECS: u64 = 30;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let config = IndexerConfig::from_env()?;
    let schema = SearchSchema::build();
    let index = open_or_create_index(&config.index_path, &schema.schema)?;
    let writer = Arc::new(Mutex::new(index.writer(50_000_000)?));

    let (client, connection) = tokio_postgres::connect(&config.database_url, NoTls)
        .await
        .context("connect to postgres")?;
    tokio::spawn(async move {
        if let Err(err) = connection.await {
            error!(?err, "database connection error");
        }
    });
    let client = Arc::new(client);

    let ingestion = IngestionService::new(client.clone(), schema.clone(), writer.clone());
    let initial_count = ingestion
        .refresh_index()
        .await
        .context("initial index refresh")?;
    info!(count = initial_count, "initial indexing complete");

    let mut interval = tokio::time::interval(config.refresh_interval);
    loop {
        interval.tick().await;
        match ingestion.refresh_index().await {
            Ok(count) => info!(count, "index refresh complete"),
            Err(err) => error!(?err, "index refresh failed"),
        }
    }
}

#[derive(Clone)]
struct IndexerConfig {
    index_path: PathBuf,
    database_url: String,
    refresh_interval: Duration,
}

impl IndexerConfig {
    fn from_env() -> Result<Self> {
        let index_path = std::env::var("ECO_INDEX_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(DEFAULT_INDEX_PATH));
        let database_url = std::env::var("ETHOS_DATABASE_URL")
            .or_else(|_| std::env::var("DATABASE_URL"))
            .context("DATABASE_URL or ETHOS_DATABASE_URL must be set")?;
        let refresh_interval = std::env::var("ECO_INDEX_REFRESH_SECS")
            .ok()
            .and_then(|value| value.parse().ok())
            .map(Duration::from_secs)
            .unwrap_or_else(|| Duration::from_secs(DEFAULT_REFRESH_SECS));

        Ok(Self {
            index_path,
            database_url,
            refresh_interval,
        })
    }
}

#[derive(Clone)]
struct SearchSchema {
    schema: Schema,
    doc_id: Field,
    entity_id: Field,
    entity_type: Field,
    entity_type_facet: Field,
    owner_id: Field,
    title: Field,
    description: Field,
    visibility: Field,
    visibility_facet: Field,
    tags: Field,
    tag_facet: Field,
    status: Field,
    kind: Field,
    content: Field,
}

impl SearchSchema {
    fn build() -> Self {
        let mut builder = Schema::builder();
        let doc_id = builder.add_text_field("doc_id", STRING | STORED);
        let entity_id = builder.add_text_field("entity_id", STRING | STORED);
        let entity_type = builder.add_text_field("entity_type", STRING | STORED);
        let entity_type_facet =
            builder.add_facet_field("entity_type_facet", FacetOptions::default().set_stored());
        let owner_id = builder.add_text_field("owner_id", STRING | STORED);
        let title = builder.add_text_field("title", TEXT | STORED);
        let description = builder.add_text_field("description", TEXT | STORED);
        let visibility = builder.add_text_field("visibility", STRING | STORED);
        let visibility_facet =
            builder.add_facet_field("visibility_facet", FacetOptions::default().set_stored());
        let tags = builder.add_text_field("tags", TEXT | STORED);
        let tag_facet = builder.add_facet_field("tag_facet", FacetOptions::default().set_stored());
        let status = builder.add_text_field("status", STRING | STORED);
        let kind = builder.add_text_field("kind", STRING | STORED);
        let content = builder.add_text_field("content", TEXT);
        let schema = builder.build();
        Self {
            schema,
            doc_id,
            entity_id,
            entity_type,
            entity_type_facet,
            owner_id,
            title,
            description,
            visibility,
            visibility_facet,
            tags,
            tag_facet,
            status,
            kind,
            content,
        }
    }

    #[allow(dead_code)]
    fn query_fields(&self) -> Vec<Field> {
        vec![self.title, self.description, self.tags, self.content]
    }
}

#[derive(Debug, Clone)]
struct SearchEntity {
    doc_id: String,
    entity_id: String,
    entity_type: String,
    owner_id: Option<String>,
    title: Option<String>,
    description: Option<String>,
    visibility: String,
    tags: Vec<String>,
    status: Option<String>,
    kind: Option<String>,
    content_fragments: Vec<String>,
}

impl SearchEntity {
    fn to_document(&self, schema: &SearchSchema) -> Document {
        let mut doc = Document::new();
        doc.add_text(schema.doc_id, &self.doc_id);
        doc.add_text(schema.entity_id, &self.entity_id);
        doc.add_text(schema.entity_type, &self.entity_type);
        let type_facet_path = format!("/type/{}", normalize_facet_value(&self.entity_type));
        let type_facet = Facet::from(type_facet_path.as_str());
        doc.add_facet(schema.entity_type_facet, type_facet);
        if let Some(owner) = &self.owner_id {
            doc.add_text(schema.owner_id, owner);
        }
        if let Some(title) = &self.title {
            doc.add_text(schema.title, title);
            doc.add_text(schema.content, title);
        }
        if let Some(description) = &self.description {
            doc.add_text(schema.description, description);
            doc.add_text(schema.content, description);
        }
        doc.add_text(schema.visibility, &self.visibility);
        let visibility_facet_path =
            format!("/visibility/{}", normalize_facet_value(&self.visibility));
        let visibility_facet = Facet::from(visibility_facet_path.as_str());
        doc.add_facet(schema.visibility_facet, visibility_facet);
        if let Some(status) = &self.status {
            doc.add_text(schema.status, status);
            doc.add_text(schema.content, status);
        }
        if let Some(kind) = &self.kind {
            doc.add_text(schema.kind, kind);
            doc.add_text(schema.content, kind);
        }
        for tag in &self.tags {
            if tag.trim().is_empty() {
                continue;
            }
            doc.add_text(schema.tags, tag);
            let tag_facet_path = format!("/tag/{}", normalize_facet_value(tag));
            let facet = Facet::from(tag_facet_path.as_str());
            doc.add_facet(schema.tag_facet, facet);
            doc.add_text(schema.content, tag);
        }
        for fragment in &self.content_fragments {
            if fragment.trim().is_empty() {
                continue;
            }
            doc.add_text(schema.content, fragment);
        }
        doc
    }
}

struct IngestionService {
    client: Arc<Client>,
    schema: SearchSchema,
    writer: Arc<Mutex<IndexWriter>>,
}

impl IngestionService {
    fn new(client: Arc<Client>, schema: SearchSchema, writer: Arc<Mutex<IndexWriter>>) -> Self {
        Self {
            client,
            schema,
            writer,
        }
    }

    async fn refresh_index(&self) -> Result<usize> {
        let entities = self.load_all_entities().await?;
        let mut writer = self.writer.lock().await;
        writer.delete_all_documents()?;
        for entity in &entities {
            let _ = writer.add_document(entity.to_document(&self.schema));
        }
        writer.commit()?;
        Ok(entities.len())
    }

    async fn load_all_entities(&self) -> Result<Vec<SearchEntity>> {
        let mut entities = Vec::new();
        entities.extend(self.load_pods().await?);
        entities.extend(self.load_artifacts().await?);
        entities.extend(self.load_quests().await?);
        Ok(entities)
    }

    async fn load_pods(&self) -> Result<Vec<SearchEntity>> {
        let rows = self
            .client
            .query(
                "SELECT id, owner_id, metadata FROM artifacts \
                 WHERE artifact_type = $1",
                &[&POD_SNAPSHOT_TYPE],
            )
            .await?;
        let mut entities = Vec::new();
        for row in rows {
            let owner_id: uuid::Uuid = row.try_get("owner_id")?;
            let metadata: Value = row.try_get("metadata")?;
            let snapshot: PodSnapshotMetadata =
                serde_json::from_value(metadata.clone()).context("decode pod snapshot metadata")?;
            if !snapshot.is_public {
                continue;
            }
            let mut tags = collect_snapshot_tags(&snapshot);
            tags.push("pod".to_string());
            normalize_tags(&mut tags);
            dedup(&mut tags);
            let mut fragments = Vec::new();
            fragments.push(snapshot.pod.title.clone());
            if let Some(description) = &snapshot.pod.description {
                fragments.push(description.clone());
            }
            for item in &snapshot.items {
                fragments.push(item.item_type.clone());
                collect_strings(&item.item_data, &mut fragments);
            }
            collect_strings(&metadata, &mut fragments);

            entities.push(SearchEntity {
                doc_id: format!("pod:{}", snapshot.pod.id),
                entity_id: snapshot.pod.id.to_string(),
                entity_type: "pod".to_string(),
                owner_id: Some(owner_id.to_string()),
                title: Some(snapshot.pod.title.clone()),
                description: snapshot.pod.description.clone(),
                visibility: "public".to_string(),
                tags,
                status: Some("published".to_string()),
                kind: Some(POD_SNAPSHOT_TYPE.to_string()),
                content_fragments: fragments,
            });
        }
        Ok(entities)
    }

    async fn load_artifacts(&self) -> Result<Vec<SearchEntity>> {
        let rows = self
            .client
            .query(
                "SELECT id, owner_id, artifact_type, metadata FROM artifacts \
                 WHERE artifact_type <> $1",
                &[&POD_SNAPSHOT_TYPE],
            )
            .await?;
        let mut entities = Vec::new();
        for row in rows {
            let id: uuid::Uuid = row.try_get("id")?;
            let owner_id: uuid::Uuid = row.try_get("owner_id")?;
            let artifact_type: String = row.try_get("artifact_type")?;
            let metadata: Value = row.try_get("metadata")?;
            let title = metadata
                .get("title")
                .and_then(Value::as_str)
                .map(|value| value.to_string())
                .or_else(|| Some(format!("{} artifact", artifact_type)));
            let description = metadata
                .get("description")
                .and_then(Value::as_str)
                .map(|value| value.to_string());
            let mut tags = collect_tags(metadata.get("tags"));
            tags.push(artifact_type.clone());
            normalize_tags(&mut tags);
            dedup(&mut tags);
            let visibility = metadata
                .get("visibility")
                .and_then(Value::as_str)
                .map(|value| value.to_lowercase())
                .unwrap_or_else(|| "private".to_string());
            let mut fragments = Vec::new();
            if let Some(title) = &title {
                fragments.push(title.clone());
            }
            if let Some(description) = &description {
                fragments.push(description.clone());
            }
            fragments.push(artifact_type.clone());
            collect_strings(&metadata, &mut fragments);

            entities.push(SearchEntity {
                doc_id: format!("artifact:{}", id),
                entity_id: id.to_string(),
                entity_type: "artifact".to_string(),
                owner_id: Some(owner_id.to_string()),
                title,
                description,
                visibility,
                tags,
                status: None,
                kind: Some(artifact_type),
                content_fragments: fragments,
            });
        }
        Ok(entities)
    }

    async fn load_quests(&self) -> Result<Vec<SearchEntity>> {
        let rows = self
            .client
            .query(
                "SELECT id, creator_id, title, description, status FROM quests",
                &[],
            )
            .await?;
        let mut entities = Vec::new();
        for row in rows {
            let id: uuid::Uuid = row.try_get("id")?;
            let creator_id: uuid::Uuid = row.try_get("creator_id")?;
            let title: String = row.try_get("title")?;
            let description: Option<String> = row.try_get("description")?;
            let status: String = row.try_get("status")?;
            let mut tags = vec![status.clone()];
            normalize_tags(&mut tags);
            dedup(&mut tags);
            let visibility = if status.eq_ignore_ascii_case("published") {
                "public".to_string()
            } else {
                "private".to_string()
            };
            let mut fragments = vec![title.clone(), status.clone()];
            if let Some(description) = &description {
                fragments.push(description.clone());
            }

            entities.push(SearchEntity {
                doc_id: format!("quest:{}", id),
                entity_id: id.to_string(),
                entity_type: "quest".to_string(),
                owner_id: Some(creator_id.to_string()),
                title: Some(title),
                description,
                visibility,
                tags,
                status: Some(status),
                kind: Some("quest".to_string()),
                content_fragments: fragments,
            });
        }
        Ok(entities)
    }
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct PodSnapshotMetadata {
    pod: PodRecord,
    items: Vec<PodItemRecord>,
    published_at: DateTime<Utc>,
    #[serde(default)]
    is_public: bool,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct PodRecord {
    id: uuid::Uuid,
    owner_id: uuid::Uuid,
    title: String,
    #[serde(default)]
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct PodItemRecord {
    item_type: String,
    #[serde(default)]
    item_data: Value,
    #[serde(default = "default_visibility")]
    visibility: String,
}

fn default_visibility() -> String {
    "public".to_string()
}

fn open_or_create_index(path: &Path, schema: &Schema) -> Result<Index> {
    if path.exists() {
        match Index::open_in_dir(path) {
            Ok(index) => return Ok(index),
            Err(err) => {
                warn!(?err, "failed to open existing index, rebuilding");
                std::fs::remove_dir_all(path).context("remove corrupted index directory")?;
            }
        }
    }
    std::fs::create_dir_all(path).context("create index directory")?;
    Index::create_in_dir(path, schema.clone()).context("create index")
}

fn collect_tags(value: Option<&Value>) -> Vec<String> {
    let mut tags = Vec::new();
    if let Some(Value::Array(items)) = value {
        for entry in items {
            if let Some(tag) = entry.as_str() {
                let trimmed = tag.trim();
                if !trimmed.is_empty() {
                    tags.push(trimmed.to_string());
                }
            }
        }
    }
    tags
}

fn collect_snapshot_tags(snapshot: &PodSnapshotMetadata) -> Vec<String> {
    let mut tags = Vec::new();
    for item in &snapshot.items {
        tags.push(item.item_type.clone());
        if let Some(Value::Array(values)) = item.item_data.get("tags") {
            for tag in values {
                if let Some(text) = tag.as_str() {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        tags.push(trimmed.to_string());
                    }
                }
            }
        }
    }
    tags
}

fn collect_strings(value: &Value, target: &mut Vec<String>) {
    match value {
        Value::String(text) => {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                target.push(trimmed.to_string());
            }
        }
        Value::Array(values) => {
            for value in values {
                collect_strings(value, target);
            }
        }
        Value::Object(map) => {
            for value in map.values() {
                collect_strings(value, target);
            }
        }
        Value::Bool(flag) => target.push(flag.to_string()),
        Value::Number(number) => target.push(number.to_string()),
        Value::Null => {}
    }
}

fn normalize_facet_value(value: &str) -> String {
    value.trim().to_lowercase().replace(['/', ' '], "-")
}

fn dedup(values: &mut Vec<String>) {
    values.sort_unstable();
    values.dedup();
}

fn normalize_tags(values: &mut Vec<String>) {
    for value in values.iter_mut() {
        *value = value.trim().to_lowercase();
    }
    values.retain(|value| !value.is_empty());
}

#[cfg(test)]
mod tests {
    use super::*;
    use tantivy::schema::Value as TantivyValue;

    #[test]
    fn search_entity_produces_expected_facets() {
        let schema = SearchSchema::build();
        let entity = SearchEntity {
            doc_id: "pod:123".to_string(),
            entity_id: "123".to_string(),
            entity_type: "pod".to_string(),
            owner_id: Some("owner".to_string()),
            title: Some("Demo Pod".to_string()),
            description: Some("A pod for demos".to_string()),
            visibility: "public".to_string(),
            tags: vec!["alpha".to_string(), "beta".to_string()],
            status: Some("published".to_string()),
            kind: Some("pod_snapshot".to_string()),
            content_fragments: vec!["extra".to_string()],
        };
        let document = entity.to_document(&schema);
        let type_facets: Vec<_> = document.get_all(schema.entity_type_facet).collect();
        assert_eq!(type_facets.len(), 1);
        let tag_facets: Vec<_> = document.get_all(schema.tag_facet).collect();
        assert_eq!(tag_facets.len(), 2);
        let visibility_facets: Vec<_> = document.get_all(schema.visibility_facet).collect();
        assert_eq!(visibility_facets.len(), 1);

        let stored_tags: Vec<String> = document
            .get_all(schema.tags)
            .filter_map(|value| match value {
                TantivyValue::Str(text) => Some(text.to_string()),
                _ => None,
            })
            .collect();
        assert_eq!(stored_tags.len(), 2);
    }
}
