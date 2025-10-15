-- migrate:up
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb;

-- migrate:down
ALTER TABLE users
    DROP COLUMN IF EXISTS profile;
