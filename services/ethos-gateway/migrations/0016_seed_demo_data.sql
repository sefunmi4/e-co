-- migrate:up
-- Seed three demo creators with pods, artifacts, and quests.
INSERT INTO users (id, email, password_hash, display_name)
VALUES
    ('124c8e23-a1fe-410b-9e18-21b3f1f08476'::uuid, 'alex@demo.test', '$argon2id$v=19$m=65536,t=3,p=4$PLDebJSTUvn8wy82Lw3qog$2bFoasIiPIEPPQWSkSDqG/tQ4qrnRfqf1Yd0G5Ptu5g', 'Alex Rivers'),
    ('2dae539f-6070-45b1-a137-b8f1c1902f00'::uuid, 'bianca@demo.test', '$argon2id$v=19$m=65536,t=3,p=4$Vubfhit3vL56l+PVp4s2hA$E/d98Gsa9R6QARLjAP65IzkVLiqte497b9aQMwtNZ8I', 'Bianca Lee'),
    ('331cdd4d-de03-4c64-b0d0-85e3d5f992f5'::uuid, 'cedric@demo.test', '$argon2id$v=19$m=65536,t=3,p=4$5Q3QYcZaetaHLxifXDQXDw$VTnboUJZOUD140AFs++pe9N2VFF2kqLS1VojjnSoEdw', 'Cedric Patel')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name;

INSERT INTO pods (id, owner_id, title, description)
VALUES
    ('38781820-b674-43f3-8a5c-b22f29ec60c7'::uuid, '124c8e23-a1fe-410b-9e18-21b3f1f08476'::uuid, 'Signal Fire Studio', 'A collaborative storytelling pod experimenting with emergent AI characters.'),
    ('e1bf3a9c-15b6-4962-8a09-31cc7e54a21c'::uuid, '2dae539f-6070-45b1-a137-b8f1c1902f00'::uuid, 'Synth Garden Lab', 'Bianca''s playground for generative music, textures, and tactile synthesis demos.'),
    ('504df4c7-16b4-4a46-9462-7ab5c9c87981'::uuid, '331cdd4d-de03-4c64-b0d0-85e3d5f992f5'::uuid, 'Living Archive Forge', 'An experimental archive that remixes artifacts collected from the Ethos network.')
ON CONFLICT (id) DO UPDATE
SET owner_id = EXCLUDED.owner_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    updated_at = NOW();

INSERT INTO artifacts (id, owner_id, artifact_type, metadata)
VALUES
    ('cda66082-ede0-46c4-9961-d6e3301fffb8'::uuid, '124c8e23-a1fe-410b-9e18-21b3f1f08476'::uuid, 'storyboard', '{"title": "Beacon script", "summary": "Branching narrative beats for the Signal Fire pilot."}'::jsonb),
    ('cce18aee-0f94-4026-b5d2-d7d6cd0d57db'::uuid, '2dae539f-6070-45b1-a137-b8f1c1902f00'::uuid, 'audio_patch', '{"title": "Garden sequencer", "summary": "Layered ambient loops for the spring showcase."}'::jsonb),
    ('17dd0837-abbf-4d42-8066-6664ac770a66'::uuid, '331cdd4d-de03-4c64-b0d0-85e3d5f992f5'::uuid, 'archive_bundle', '{"title": "Memory weave", "summary": "Curated set of artifacts destined for remix in the Forge."}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET owner_id = EXCLUDED.owner_id,
    artifact_type = EXCLUDED.artifact_type,
    metadata = EXCLUDED.metadata;

INSERT INTO quests (id, creator_id, title, description, status)
VALUES
    ('39c1a6d4-8412-45c4-bef3-93361fd255c7'::uuid, '124c8e23-a1fe-410b-9e18-21b3f1f08476'::uuid, 'Storyboard feedback circle', 'Collect async critiques on the pilot script before the next recording session.', 'published'),
    ('63eaede9-ae59-4850-a2b2-4d8e7d6c6386'::uuid, '2dae539f-6070-45b1-a137-b8f1c1902f00'::uuid, 'Patch layering jam', 'Invite sound designers to layer new patterns on top of the Garden sequencer.', 'published'),
    ('05549d81-bcd0-447d-b22d-9eb5f213a189'::uuid, '331cdd4d-de03-4c64-b0d0-85e3d5f992f5'::uuid, 'Archive remix sprint', 'Gather remix proposals for the latest Memory weave drop.', 'published')
ON CONFLICT (id) DO UPDATE
SET creator_id = EXCLUDED.creator_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    updated_at = NOW();

-- migrate:down
DELETE FROM quests
WHERE id IN (
    '39c1a6d4-8412-45c4-bef3-93361fd255c7'::uuid,
    '63eaede9-ae59-4850-a2b2-4d8e7d6c6386'::uuid,
    '05549d81-bcd0-447d-b22d-9eb5f213a189'::uuid
);

DELETE FROM artifacts
WHERE id IN (
    'cda66082-ede0-46c4-9961-d6e3301fffb8'::uuid,
    'cce18aee-0f94-4026-b5d2-d7d6cd0d57db'::uuid,
    '17dd0837-abbf-4d42-8066-6664ac770a66'::uuid
);

DELETE FROM pods
WHERE id IN (
    '38781820-b674-43f3-8a5c-b22f29ec60c7'::uuid,
    'e1bf3a9c-15b6-4962-8a09-31cc7e54a21c'::uuid,
    '504df4c7-16b4-4a46-9462-7ab5c9c87981'::uuid
);

DELETE FROM users
WHERE id IN (
    '124c8e23-a1fe-410b-9e18-21b3f1f08476'::uuid,
    '2dae539f-6070-45b1-a137-b8f1c1902f00'::uuid,
    '331cdd4d-de03-4c64-b0d0-85e3d5f992f5'::uuid
);
