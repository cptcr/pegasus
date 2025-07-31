-- UP
-- Giveaway system tables

CREATE TABLE IF NOT EXISTS giveaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  message_id VARCHAR(20),
  host_id VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  prize TEXT NOT NULL,
  winner_count INTEGER DEFAULT 1,
  end_time TIMESTAMP NOT NULL,
  ended BOOLEAN DEFAULT false,
  cancelled BOOLEAN DEFAULT false,
  requirements JSONB DEFAULT '{}',
  bonus_entries JSONB DEFAULT '{}',
  blacklist VARCHAR(20)[] DEFAULT '{}',
  whitelist VARCHAR(20)[] DEFAULT '{}',
  embed_config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS giveaway_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id VARCHAR(20) NOT NULL,
  entry_count INTEGER DEFAULT 1,
  entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  bonus_reason TEXT,
  entry_metadata JSONB DEFAULT '{}',
  UNIQUE(giveaway_id, user_id)
);

CREATE TABLE IF NOT EXISTS giveaway_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id VARCHAR(20) NOT NULL,
  claimed BOOLEAN DEFAULT false,
  claim_time TIMESTAMP,
  rerolled BOOLEAN DEFAULT false,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  prize_details JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS giveaway_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  embed_config JSONB NOT NULL,
  requirements JSONB DEFAULT '{}',
  bonus_entries JSONB DEFAULT '{}',
  creator_id VARCHAR(20) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, name)
);

-- Indexes for performance
CREATE INDEX idx_giveaways_guild ON giveaways(guild_id);
CREATE INDEX idx_giveaways_active ON giveaways(ended, cancelled) WHERE ended = false AND cancelled = false;
CREATE INDEX idx_giveaway_entries_giveaway ON giveaway_entries(giveaway_id);
CREATE INDEX idx_giveaway_entries_user ON giveaway_entries(user_id);
CREATE INDEX idx_giveaway_winners_giveaway ON giveaway_winners(giveaway_id);
CREATE INDEX idx_giveaway_templates_guild ON giveaway_templates(guild_id);

-- DOWN
DROP INDEX IF EXISTS idx_giveaway_templates_guild;
DROP INDEX IF EXISTS idx_giveaway_winners_giveaway;
DROP INDEX IF EXISTS idx_giveaway_entries_user;
DROP INDEX IF EXISTS idx_giveaway_entries_giveaway;
DROP INDEX IF EXISTS idx_giveaways_active;
DROP INDEX IF EXISTS idx_giveaways_guild;
DROP TABLE IF EXISTS giveaway_templates;
DROP TABLE IF EXISTS giveaway_winners;
DROP TABLE IF EXISTS giveaway_entries;
DROP TABLE IF EXISTS giveaways;