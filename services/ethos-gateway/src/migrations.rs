use anyhow::{bail, Context};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use deadpool_postgres::Pool;
use uuid::Uuid;

const MIGRATIONS: &[&str] = &[
    include_str!("../migrations/0001_create_users.sql"),
    include_str!("../migrations/0002_add_is_guest_to_users.sql"),
];

pub async fn run_migrations(pool: &Pool) -> anyhow::Result<()> {
    {
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
    }

    let client = pool
        .get()
        .await
        .context("failed to acquire postgres client for legacy password backfill")?;

    let rows = client
        .query(
            "SELECT id, email FROM users WHERE password_hash IS NULL",
            &[],
        )
        .await
        .context("failed to query legacy users with missing password hashes")?;

    if !rows.is_empty() {
        let argon2 = Argon2::default();

        for row in rows {
            let id: Uuid = row
                .try_get("id")
                .context("failed to decode user id while backfilling password hash")?;
            let email: String = row
                .try_get("email")
                .context("failed to decode user email while backfilling password hash")?;

            let temporary_password = Uuid::new_v4().to_string();
            let salt = SaltString::generate(&mut OsRng);
            let password_hash = argon2
                .hash_password(temporary_password.as_bytes(), &salt)
                .with_context(|| format!("failed to hash temporary password for user {id}"))?
                .to_string();

            client
                .execute(
                    "UPDATE users SET password_hash = $1 WHERE id = $2",
                    &[&password_hash, &id],
                )
                .await
                .with_context(|| format!("failed to update password hash for user {id}"))?;

            tracing::warn!(
                %id,
                %email,
                %temporary_password,
                "generated temporary password for legacy user; prompt for reset"
            );
        }
    }

    let null_hash_count: i64 = client
        .query_one(
            "SELECT COUNT(*) FROM users WHERE password_hash IS NULL",
            &[],
        )
        .await
        .context("failed to verify password hash backfill")?
        .try_get(0)
        .context("failed to decode password hash backfill count")?;

    if null_hash_count == 0 {
        client
            .batch_execute("ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;")
            .await
            .context("failed to enforce users.password_hash NOT NULL constraint")?;
    } else {
        bail!(
            "unable to enforce users.password_hash NOT NULL constraint; {null_hash_count} legacy users remain"
        );
    }

    Ok(())
}
