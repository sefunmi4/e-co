-- migrate:up
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY,
    event_type TEXT NOT NULL,
    pod_id UUID REFERENCES pods(id) ON DELETE SET NULL,
    artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_pod_id
    ON analytics_events(pod_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_artifact_id
    ON analytics_events(artifact_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type
    ON analytics_events(event_type);

-- migrate:down
DROP TABLE IF EXISTS analytics_events;
