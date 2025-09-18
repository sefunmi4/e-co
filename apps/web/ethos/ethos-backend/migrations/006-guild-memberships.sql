CREATE TABLE IF NOT EXISTS guild_memberships (
  id SERIAL PRIMARY KEY,
  guild_id INTEGER REFERENCES guilds(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, user_id)
);
