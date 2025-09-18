CREATE TABLE IF NOT EXISTS party_membership (
  party_id INTEGER NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (party_id, user_id)
);
