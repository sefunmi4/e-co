-- migrate:up
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure legacy databases gain the newer optional columns.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE users SET created_at = NOW() WHERE created_at IS NULL;

ALTER TABLE users
    ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE users
    ALTER COLUMN created_at SET NOT NULL;

-- migrate:down
-- users table is foundational and is intentionally left untouched on rollback.
