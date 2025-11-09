-- Legacy cleanup: drop outdated blacklist table if it exists with deprecated columns
DROP TABLE IF EXISTS blacklist CASCADE;

-- Recreate blacklist table with normalized schema
CREATE TABLE blacklist (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  blacklisted_by VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  blacklisted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, guild_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blacklist_guild ON blacklist(guild_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_user ON blacklist(user_id);
