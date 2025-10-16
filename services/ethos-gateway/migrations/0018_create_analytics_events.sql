-- migrate:up
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY,
    event_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type
    ON analytics_events (event_type);

CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred_at
    ON analytics_events (occurred_at);

-- migrate:down
DROP TABLE IF EXISTS analytics_events;
