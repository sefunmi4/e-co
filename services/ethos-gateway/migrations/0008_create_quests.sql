-- migrate:up
CREATE TABLE IF NOT EXISTS quests (
    id UUID PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quests_creator_id ON quests(creator_id);
CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status);

-- migrate:down
DROP TABLE IF EXISTS quests;
