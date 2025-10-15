-- migrate:up
CREATE TABLE IF NOT EXISTS guilds (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guilds_owner_id ON guilds(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guilds_name ON guilds(LOWER(name));

-- migrate:down
DROP TABLE IF EXISTS guilds;
