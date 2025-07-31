-- UP
-- Initial schema creation

-- Guild settings table
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id VARCHAR(20) PRIMARY KEY,
  prefix VARCHAR(10) DEFAULT '!',
  mod_log_channel VARCHAR(20),
  mute_role VARCHAR(20),
  join_to_create_category VARCHAR(20),
  join_to_create_channel VARCHAR(20),
  ticket_category VARCHAR(20),
  auto_role VARCHAR(20),
  welcome_channel VARCHAR(20),
  welcome_message TEXT,
  leave_channel VARCHAR(20),
  leave_message TEXT,
  xp_enabled BOOLEAN DEFAULT true,
  xp_rate INTEGER DEFAULT 15,
  xp_cooldown INTEGER DEFAULT 60,
  level_up_message TEXT,
  level_up_channel VARCHAR(20),
  log_channel VARCHAR(20),
  anti_spam BOOLEAN DEFAULT false,
  anti_spam_action VARCHAR(20) DEFAULT 'mute',
  anti_spam_threshold INTEGER DEFAULT 5,
  auto_mod BOOLEAN DEFAULT false,
  filter_profanity BOOLEAN DEFAULT false,
  filter_invites BOOLEAN DEFAULT false,
  filter_links BOOLEAN DEFAULT false,
  language VARCHAR(10) DEFAULT 'en',
  welcome_enabled BOOLEAN DEFAULT false,
  welcome_card JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id VARCHAR(20),
  guild_id VARCHAR(20),
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  voice_time INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  warnings INTEGER DEFAULT 0,
  reputation INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  last_xp_gain TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_voice_join TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, guild_id)
);

-- Moderation actions table
CREATE TABLE IF NOT EXISTS mod_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  moderator_id VARCHAR(20) NOT NULL,
  action VARCHAR(20) NOT NULL,
  reason TEXT,
  duration INTEGER,
  expires_at TIMESTAMP,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_mod_actions_guild_user ON mod_actions(guild_id, user_id);
CREATE INDEX idx_mod_actions_active ON mod_actions(active) WHERE active = true;
CREATE INDEX idx_user_profiles_xp ON user_profiles(guild_id, total_xp DESC);

-- DOWN
DROP INDEX IF EXISTS idx_user_profiles_xp;
DROP INDEX IF EXISTS idx_mod_actions_active;
DROP INDEX IF EXISTS idx_mod_actions_guild_user;
DROP TABLE IF EXISTS mod_actions;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS guild_settings;