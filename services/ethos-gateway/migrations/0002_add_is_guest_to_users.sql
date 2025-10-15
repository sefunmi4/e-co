-- migrate:up
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

-- migrate:down
ALTER TABLE users
    DROP COLUMN IF EXISTS is_guest;
