use anyhow::Context;
use deadpool_postgres::Pool;

const MIGRATIONS: &[&str] = &[include_str!("../migrations/0001_create_users.sql")];

pub async fn run_migrations(pool: &Pool) -> anyhow::Result<()> {
    let client = pool
        .get()
        .await
        .context("failed to acquire postgres client for migrations")?;

    for migration in MIGRATIONS {
        client
            .batch_execute(migration)
            .await
            .context("failed to execute database migration")?;
    }

    Ok(())
}
