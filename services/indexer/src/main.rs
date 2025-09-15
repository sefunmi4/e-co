use std::path::PathBuf;
use tantivy::collector::TopDocs;
use tantivy::schema::{Schema, TEXT};
use tantivy::{doc, Index};
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let index_path = PathBuf::from("./.tmp/index");
    let schema = Schema::builder().add_text_field("content", TEXT).build();
    let index = Index::create_in_ram(schema.clone());
    let mut writer = index.writer(50_000_000)?;
    writer.add_document(doc!(schema.get_field("content").unwrap() => "hello eco"));
    writer.commit()?;

    let reader = index.reader()?;
    let searcher = reader.searcher();
    let query_parser = tantivy::query::QueryParser::for_index(&index, vec![schema.get_field("content").unwrap()]);
    let query = query_parser.parse_query("eco")?;
    let top_docs = searcher.search(&query, &TopDocs::with_limit(5))?;
    info!(?top_docs, "initial Tantivy index seeded");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn runs_indexer() {
        main().await.expect("indexer to run");
    }
}
