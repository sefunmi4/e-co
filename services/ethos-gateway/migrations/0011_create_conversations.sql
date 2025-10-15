-- migrate:up
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY,
    guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE,
    quest_id UUID REFERENCES quests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_guild_id ON conversations(guild_id);
CREATE INDEX IF NOT EXISTS idx_conversations_quest_id ON conversations(quest_id);

-- migrate:down
DROP TABLE IF EXISTS conversations;
