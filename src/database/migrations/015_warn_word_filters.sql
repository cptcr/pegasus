-- Ensure giveaways table has announcement_sent column
ALTER TABLE IF EXISTS giveaways
ADD COLUMN IF NOT EXISTS announcement_sent BOOLEAN DEFAULT FALSE NOT NULL;

-- Create mod_log_settings table
CREATE TABLE IF NOT EXISTS mod_log_settings (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT mod_log_settings_guild_category_unique UNIQUE (guild_id, category)
);

-- Create word_filter_rules table
CREATE TABLE IF NOT EXISTS word_filter_rules (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  match_type VARCHAR(20) DEFAULT 'literal' NOT NULL,
  case_sensitive BOOLEAN DEFAULT FALSE NOT NULL,
  whole_word BOOLEAN DEFAULT TRUE NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium' NOT NULL,
  auto_delete BOOLEAN DEFAULT TRUE NOT NULL,
  notify_channel_id VARCHAR(20),
  actions JSONB DEFAULT '[]'::jsonb NOT NULL,
  created_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS word_filter_rules_guild_idx ON word_filter_rules(guild_id);
