-- migrate:up
ALTER TABLE pod_items
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

UPDATE pod_items SET visibility = 'public' WHERE visibility IS NULL;

CREATE INDEX IF NOT EXISTS idx_pod_items_pod_id_visibility
    ON pod_items(pod_id, visibility);

-- migrate:down
DROP INDEX IF EXISTS idx_pod_items_pod_id_visibility;
ALTER TABLE pod_items
    DROP COLUMN IF EXISTS visibility;
