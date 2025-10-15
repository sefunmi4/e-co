-- migrate:up
CREATE TABLE IF NOT EXISTS pods (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pods_owner_id ON pods(owner_id);

-- migrate:down
DROP TABLE IF EXISTS pods;
