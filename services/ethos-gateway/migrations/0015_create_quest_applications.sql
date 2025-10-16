-- migrate:up
CREATE TABLE IF NOT EXISTS quest_applications (
    id UUID PRIMARY KEY,
    quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    note TEXT,
    decision_note TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(quest_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_applications_quest_id ON quest_applications(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_applications_applicant ON quest_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_quest_applications_status ON quest_applications(status);

-- migrate:down
DROP TABLE IF EXISTS quest_applications;
