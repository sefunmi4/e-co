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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE password_hash IS NULL) THEN
        RAISE EXCEPTION 'users.password_hash must be populated before running this migration'
            USING HINT = 'Populate users.password_hash for existing accounts and re-run the migration.';
    END IF;
END;
$$;

ALTER TABLE users
    ALTER COLUMN password_hash SET NOT NULL;
