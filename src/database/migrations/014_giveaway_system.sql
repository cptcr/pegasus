-- Create giveaways table
CREATE TABLE IF NOT EXISTS giveaways (
  giveaway_id VARCHAR(20) PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  channel_id VARCHAR(20) NOT NULL,
  message_id VARCHAR(20),
  hosted_by VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  prize TEXT NOT NULL,
  description TEXT,
  winner_count INTEGER DEFAULT 1 NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'ended', 'cancelled')),
  entries INTEGER DEFAULT 0 NOT NULL,
  requirements JSON DEFAULT '{}' NOT NULL,
  bonus_entries JSON DEFAULT '{}' NOT NULL,
  embed_color INTEGER DEFAULT 39423 NOT NULL,
  winners JSON,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create giveaway_entries table
CREATE TABLE IF NOT EXISTS giveaway_entries (
  giveaway_id VARCHAR(20) NOT NULL REFERENCES giveaways(giveaway_id) ON DELETE CASCADE,
  user_id VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entries INTEGER DEFAULT 1 NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (giveaway_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id);
CREATE INDEX IF NOT EXISTS idx_giveaways_status ON giveaways(status);
CREATE INDEX IF NOT EXISTS idx_giveaways_end_time ON giveaways(end_time);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user ON giveaway_entries(user_id);

-- Create updated_at trigger for giveaways
CREATE OR REPLACE FUNCTION update_giveaways_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_giveaways_updated_at
  BEFORE UPDATE ON giveaways
  FOR EACH ROW
  EXECUTE FUNCTION update_giveaways_updated_at();

-- Create updated_at trigger for giveaway_entries
CREATE OR REPLACE FUNCTION update_giveaway_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_giveaway_entries_updated_at
  BEFORE UPDATE ON giveaway_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_giveaway_entries_updated_at();