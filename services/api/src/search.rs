use std::path::{Path, PathBuf};

use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use tantivy::collector::{FacetCollector, FacetCounts, MultiCollector, TopDocs};
use tantivy::query::{AllQuery, BooleanQuery, Occur, Query, QueryParser, TermQuery};
use tantivy::schema::{Facet, Field, IndexRecordOption, Schema, Value as TantivyValue};
use tantivy::{Document, Index, IndexReader, ReloadPolicy, Term};
use thiserror::Error;

const DEFAULT_INDEX_PATH: &str = "./.tmp/index";
const ENTITY_TYPE_FACET_FIELD: &str = "entity_type_facet";
const TAG_FACET_FIELD: &str = "tag_facet";
const VISIBILITY_FACET_FIELD: &str = "visibility_facet";

#[derive(Debug, Error)]
pub enum SearchError {
    #[error("failed to open Tantivy index: {0}")]
    Index(#[from] tantivy::TantivyError),
    #[error("query parse error: {0}")]
    Query(#[from] tantivy::query::QueryParserError),
    #[error("index schema missing field `{0}`")]
    MissingField(&'static str),
}

impl SearchError {
    pub fn status_code(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}

#[derive(Clone)]
pub struct SearchIndex {
    index: Index,
    reader: IndexReader,
    fields: SearchFields,
}

#[derive(Clone)]
struct SearchFields {
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

impl SearchFields {
    fn resolve(schema: &Schema) -> Result<Self, SearchError> {
        Ok(Self {
            doc_id: schema
                .get_field("doc_id")
                .map_err(|_| SearchError::MissingField("doc_id"))?,
            entity_id: schema
                .get_field("entity_id")
                .map_err(|_| SearchError::MissingField("entity_id"))?,
            entity_type: schema
                .get_field("entity_type")
                .map_err(|_| SearchError::MissingField("entity_type"))?,
            entity_type_facet: schema
                .get_field("entity_type_facet")
                .map_err(|_| SearchError::MissingField("entity_type_facet"))?,
            owner_id: schema
                .get_field("owner_id")
                .map_err(|_| SearchError::MissingField("owner_id"))?,
            title: schema
                .get_field("title")
                .map_err(|_| SearchError::MissingField("title"))?,
            description: schema
                .get_field("description")
                .map_err(|_| SearchError::MissingField("description"))?,
            visibility: schema
                .get_field("visibility")
                .map_err(|_| SearchError::MissingField("visibility"))?,
            visibility_facet: schema
                .get_field("visibility_facet")
                .map_err(|_| SearchError::MissingField("visibility_facet"))?,
            tags: schema
                .get_field("tags")
                .map_err(|_| SearchError::MissingField("tags"))?,
            tag_facet: schema
                .get_field("tag_facet")
                .map_err(|_| SearchError::MissingField("tag_facet"))?,
            status: schema
                .get_field("status")
                .map_err(|_| SearchError::MissingField("status"))?,
            kind: schema
                .get_field("kind")
                .map_err(|_| SearchError::MissingField("kind"))?,
            content: schema
                .get_field("content")
                .map_err(|_| SearchError::MissingField("content"))?,
        })
    }

    fn query_fields(&self) -> Vec<Field> {
        vec![self.title, self.description, self.tags, self.content]
    }
}

pub struct SearchRequest<'a> {
    pub query: &'a str,
    pub limit: usize,
    pub entity_types: &'a [String],
    pub tags: &'a [String],
    pub visibilities: &'a [String],
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResults {
    pub hits: Vec<SearchHit>,
    pub facets: FacetSummary,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchHit {
    pub score: f32,
    pub doc_id: String,
    pub entity_id: String,
    pub entity_type: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub owner_id: Option<String>,
    pub visibility: Option<String>,
    pub tags: Vec<String>,
    pub status: Option<String>,
    pub kind: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct FacetSummary {
    pub entity_type: Vec<FacetBucket>,
    pub tag: Vec<FacetBucket>,
    pub visibility: Vec<FacetBucket>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FacetBucket {
    pub value: String,
    pub count: u64,
}

impl SearchIndex {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, SearchError> {
        let path = path.as_ref();
        let index_path = if path.as_os_str().is_empty() {
            PathBuf::from(DEFAULT_INDEX_PATH)
        } else {
            path.to_path_buf()
        };
        let index = Index::open_in_dir(index_path)?;
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommit)
            .try_into()?;
        let schema = index.schema();
        let fields = SearchFields::resolve(&schema)?;
        Ok(Self {
            index,
            reader,
            fields,
        })
    }

    pub fn search(&self, request: SearchRequest<'_>) -> Result<SearchResults, SearchError> {
        if request.query.trim().is_empty()
            && request.entity_types.is_empty()
            && request.tags.is_empty()
            && request.visibilities.is_empty()
        {
            return Ok(SearchResults {
                hits: Vec::new(),
                facets: FacetSummary::default(),
            });
        }

        self.reader.reload()?;
        let searcher = self.reader.searcher();
        let mut parser = QueryParser::for_index(&self.index, self.fields.query_fields());
        parser.set_conjunction_by_default();

        let normalized_types = normalize_filters(request.entity_types);
        let normalized_tags = normalize_filters(request.tags);
        let normalized_visibility = normalize_filters(request.visibilities);

        let base_query: Box<dyn Query> = if request.query.trim().is_empty() {
            Box::new(AllQuery)
        } else {
            Box::new(parser.parse_query(request.query)?)
        };

        let mut filters: Vec<(Occur, Box<dyn Query>)> = Vec::new();
        if let Some(filter) = build_terms_filter(self.fields.entity_type, &normalized_types) {
            filters.push((Occur::Must, filter));
        }
        if let Some(filter) = build_terms_filter(self.fields.tags, &normalized_tags) {
            filters.push((Occur::Must, filter));
        }
        if let Some(filter) = build_terms_filter(self.fields.visibility, &normalized_visibility) {
            filters.push((Occur::Must, filter));
        }

        let full_query: Box<dyn Query> = if filters.is_empty() {
            base_query
        } else {
            let mut clauses = vec![(Occur::Must, base_query)];
            clauses.extend(filters.into_iter());
            Box::new(BooleanQuery::new(clauses))
        };

        let mut collector = MultiCollector::new();
        let limit = request.limit.max(1);
        let top_docs_handle = collector.add_collector(TopDocs::with_limit(limit));
        let mut type_collector = FacetCollector::for_field(ENTITY_TYPE_FACET_FIELD);
        type_collector.add_facet(Facet::from("/type"));
        let mut tag_collector = FacetCollector::for_field(TAG_FACET_FIELD);
        tag_collector.add_facet(Facet::from("/tag"));
        let mut visibility_collector = FacetCollector::for_field(VISIBILITY_FACET_FIELD);
        visibility_collector.add_facet(Facet::from("/visibility"));
        let type_handle = collector.add_collector(type_collector);
        let tag_handle = collector.add_collector(tag_collector);
        let visibility_handle = collector.add_collector(visibility_collector);

        let mut fruits = searcher.search(&*full_query, &collector)?;
        let top_docs = top_docs_handle.extract(&mut fruits);
        let type_counts = type_handle.extract(&mut fruits);
        let tag_counts = tag_handle.extract(&mut fruits);
        let visibility_counts = visibility_handle.extract(&mut fruits);

        let hits = top_docs
            .into_iter()
            .map(|(score, address)| {
                let doc = searcher.doc(address)?;
                Ok(SearchHit {
                    score,
                    doc_id: extract_first(&doc, self.fields.doc_id).unwrap_or_default(),
                    entity_id: extract_first(&doc, self.fields.entity_id).unwrap_or_default(),
                    entity_type: extract_first(&doc, self.fields.entity_type).unwrap_or_default(),
                    title: extract_first(&doc, self.fields.title),
                    description: extract_first(&doc, self.fields.description),
                    owner_id: extract_first(&doc, self.fields.owner_id),
                    visibility: extract_first(&doc, self.fields.visibility),
                    tags: extract_all(&doc, self.fields.tags),
                    status: extract_first(&doc, self.fields.status),
                    kind: extract_first(&doc, self.fields.kind),
                })
            })
            .collect::<Result<Vec<_>, tantivy::TantivyError>>()?;

        let facets = FacetSummary {
            entity_type: facet_buckets(&type_counts, "/type"),
            tag: facet_buckets(&tag_counts, "/tag"),
            visibility: facet_buckets(&visibility_counts, "/visibility"),
        };

        Ok(SearchResults { hits, facets })
    }

    #[cfg(test)]
    pub(crate) fn from_index(index: Index) -> Result<Self, SearchError> {
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::Manual)
            .try_into()?;
        let schema = index.schema();
        let fields = SearchFields::resolve(&schema)?;
        Ok(Self {
            index,
            reader,
            fields,
        })
    }
}

fn build_terms_filter(field: Field, values: &[String]) -> Option<Box<dyn Query>> {
    if values.is_empty() {
        return None;
    }
    let clauses: Vec<(Occur, Box<dyn Query>)> = values
        .iter()
        .map(|value| {
            let term = Term::from_field_text(field, value);
            (
                Occur::Should,
                Box::new(TermQuery::new(term, IndexRecordOption::Basic)) as Box<dyn Query>,
            )
        })
        .collect();
    Some(Box::new(BooleanQuery::new(clauses)))
}

fn normalize_filters(values: &[String]) -> Vec<String> {
    let mut normalized: Vec<String> = values
        .iter()
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty())
        .collect();
    normalized.sort_unstable();
    normalized.dedup();
    normalized
}

fn facet_buckets(counts: &FacetCounts, root: &str) -> Vec<FacetBucket> {
    counts
        .get(root)
        .filter_map(|(facet, count)| {
            facet.to_path().last().map(|value| FacetBucket {
                value: value.to_string(),
                count,
            })
        })
        .collect()
}

fn extract_first(doc: &Document, field: Field) -> Option<String> {
    doc.get_first(field)
        .and_then(|value| value.as_text().map(|text| text.to_string()))
}

fn extract_all(doc: &Document, field: Field) -> Vec<String> {
    let mut values: Vec<String> = doc
        .get_all(field)
        .filter_map(|value| match value {
            TantivyValue::Str(text) => Some(text.to_string()),
            _ => None,
        })
        .collect();
    values.sort_unstable();
    values.dedup();
    values
}

#[cfg(test)]
mod tests {
    use super::*;
    use tantivy::schema::{SchemaBuilder, STORED, STRING, TEXT};
    use tantivy::{doc, Index};

    fn build_test_index() -> (Index, SearchFields) {
        let mut builder = SchemaBuilder::default();
        let doc_id = builder.add_text_field("doc_id", STRING | STORED);
        let entity_id = builder.add_text_field("entity_id", STRING | STORED);
        let entity_type = builder.add_text_field("entity_type", STRING | STORED);
        let entity_type_facet = builder.add_facet_field(
            "entity_type_facet",
            tantivy::schema::FacetOptions::default().set_stored(),
        );
        let owner_id = builder.add_text_field("owner_id", STRING | STORED);
        let title = builder.add_text_field("title", TEXT | STORED);
        let description = builder.add_text_field("description", TEXT | STORED);
        let visibility = builder.add_text_field("visibility", STRING | STORED);
        let visibility_facet = builder.add_facet_field(
            "visibility_facet",
            tantivy::schema::FacetOptions::default().set_stored(),
        );
        let tags = builder.add_text_field("tags", TEXT | STORED);
        let tag_facet = builder.add_facet_field(
            "tag_facet",
            tantivy::schema::FacetOptions::default().set_stored(),
        );
        let status = builder.add_text_field("status", STRING | STORED);
        let kind = builder.add_text_field("kind", STRING | STORED);
        let content = builder.add_text_field("content", TEXT);
        let schema = builder.build();
        let index = Index::create_in_ram(schema.clone());
        let fields = SearchFields {
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
        };
        (index, fields)
    }

    fn index_sample_docs(index: &Index, fields: &SearchFields) {
        let mut writer = index.writer(50_000_000).expect("writer");
        writer
            .add_document(doc!(
                fields.doc_id => "pod:1",
                fields.entity_id => "1",
                fields.entity_type => "pod",
                fields.entity_type_facet => Facet::from("/type/pod"),
                fields.title => "Community Pod",
                fields.description => "A vibrant community hub",
                fields.visibility => "public",
                fields.visibility_facet => Facet::from("/visibility/public"),
                fields.tags => "community",
                fields.tag_facet => Facet::from("/tag/community"),
                fields.status => "published",
                fields.kind => "pod_snapshot",
                fields.content => "community hub",
            ))
            .expect("add pod");
        writer
            .add_document(doc!(
                fields.doc_id => "artifact:2",
                fields.entity_id => "2",
                fields.entity_type => "artifact",
                fields.entity_type_facet => Facet::from("/type/artifact"),
                fields.title => "Community Artifact",
                fields.description => "artifact for builders",
                fields.visibility => "public",
                fields.visibility_facet => Facet::from("/visibility/public"),
                fields.tags => "community",
                fields.tags => "build",
                fields.tag_facet => Facet::from("/tag/community"),
                fields.tag_facet => Facet::from("/tag/build"),
                fields.kind => "blueprint",
                fields.content => "artifact community build",
            ))
            .expect("add artifact");
        writer
            .add_document(doc!(
                fields.doc_id => "quest:3",
                fields.entity_id => "3",
                fields.entity_type => "quest",
                fields.entity_type_facet => Facet::from("/type/quest"),
                fields.title => "Community Challenge",
                fields.description => "A private challenge",
                fields.visibility => "private",
                fields.visibility_facet => Facet::from("/visibility/private"),
                fields.tags => "private",
                fields.tag_facet => Facet::from("/tag/private"),
                fields.status => "draft",
                fields.kind => "quest",
                fields.content => "challenge community",
            ))
            .expect("add quest");
        writer.commit().expect("commit");
    }

    #[test]
    fn search_returns_facets_and_hits() {
        let (index, fields) = build_test_index();
        index_sample_docs(&index, &fields);
        let search_index = SearchIndex::from_index(index).expect("search index");
        let request = SearchRequest {
            query: "community",
            limit: 10,
            entity_types: &[],
            tags: &[],
            visibilities: &[],
        };
        let results = search_index.search(request).expect("results");
        assert_eq!(results.hits.len(), 3);
        let mut type_facets: Vec<_> = results
            .facets
            .entity_type
            .iter()
            .map(|bucket| bucket.value.as_str())
            .collect();
        type_facets.sort();
        assert_eq!(type_facets, vec!["artifact", "pod", "quest"]);
        assert!(results
            .facets
            .tag
            .iter()
            .any(|bucket| bucket.value == "community"));
    }

    #[test]
    fn search_filters_by_visibility_and_type() {
        let (index, fields) = build_test_index();
        index_sample_docs(&index, &fields);
        let search_index = SearchIndex::from_index(index).expect("search index");
        let request = SearchRequest {
            query: "community",
            limit: 10,
            entity_types: &vec!["quest".to_string()],
            tags: &[],
            visibilities: &vec!["private".to_string()],
        };
        let results = search_index.search(request).expect("results");
        assert_eq!(results.hits.len(), 1);
        let hit = &results.hits[0];
        assert_eq!(hit.entity_type, "quest");
        assert_eq!(hit.visibility.as_deref(), Some("private"));
    }
}
