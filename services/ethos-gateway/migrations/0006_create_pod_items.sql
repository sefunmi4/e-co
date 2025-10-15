-- migrate:up
CREATE TABLE IF NOT EXISTS pod_items (
    id UUID PRIMARY KEY,
    pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
    artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
    item_type TEXT NOT NULL,
    item_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pod_items_pod_id_position ON pod_items(pod_id, position);
CREATE INDEX IF NOT EXISTS idx_pod_items_artifact_id ON pod_items(artifact_id);

-- migrate:down
DROP TABLE IF EXISTS pod_items;
