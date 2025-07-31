-- UP
-- Advanced XP System Enhancements

-- XP Multipliers Table (Channel-specific multipliers)
CREATE TABLE IF NOT EXISTS xp_channel_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, channel_id)
);

-- XP Role Multipliers Table
CREATE TABLE IF NOT EXISTS xp_role_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  role_id VARCHAR(20) NOT NULL,
  multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, role_id)
);

-- XP User Multipliers Table (for premium users, streak bonuses)
CREATE TABLE IF NOT EXISTS xp_user_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(20) NOT NULL,
  guild_id VARCHAR(20) NOT NULL,
  multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  reason VARCHAR(50) NOT NULL, -- 'premium', 'streak', 'boost', etc.
  expires_at TIMESTAMP,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, guild_id, reason)
);

-- XP Time-based Events Table
CREATE TABLE IF NOT EXISTS xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  multiplier DECIMAL(3,2) NOT NULL DEFAULT 2.0,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  recurring BOOLEAN DEFAULT false,
  recurring_pattern VARCHAR(50), -- 'weekly', 'weekend', 'daily', etc.
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- XP Gain Logs Table (Detailed tracking)
CREATE TABLE IF NOT EXISTS xp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(20) NOT NULL,
  guild_id VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  source VARCHAR(50) NOT NULL, -- 'message', 'voice', 'bonus', 'event', 'command'
  channel_id VARCHAR(20),
  multipliers_applied JSONB, -- Store all multipliers that were applied
  final_amount INTEGER NOT NULL, -- Amount after multipliers
  metadata JSONB, -- Additional data like message length, voice duration, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- XP Statistics Table (Aggregated data for analytics)
CREATE TABLE IF NOT EXISTS xp_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(20) NOT NULL,
  guild_id VARCHAR(20) NOT NULL,
  period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  period_start DATE NOT NULL,
  total_xp_gained INTEGER DEFAULT 0,
  message_xp INTEGER DEFAULT 0,
  voice_xp INTEGER DEFAULT 0,
  bonus_xp INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  voice_minutes INTEGER DEFAULT 0,
  avg_xp_per_message DECIMAL(10,2),
  avg_xp_per_hour DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, guild_id, period_type, period_start)
);

-- Level Role Rewards Table
CREATE TABLE IF NOT EXISTS level_role_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  level INTEGER NOT NULL,
  role_id VARCHAR(20) NOT NULL,
  remove_previous BOOLEAN DEFAULT false, -- Remove previous level roles
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, level)
);

-- XP Decay Configuration Table
CREATE TABLE IF NOT EXISTS xp_decay_config (
  guild_id VARCHAR(20) PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  decay_rate DECIMAL(5,2) DEFAULT 1.0, -- Percentage per period
  decay_period INTEGER DEFAULT 7, -- Days
  min_inactive_days INTEGER DEFAULT 30, -- Days before decay starts
  max_decay_percent DECIMAL(5,2) DEFAULT 50.0, -- Maximum total decay
  exempt_roles JSONB, -- Array of role IDs exempt from decay
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Anti-Abuse Detection Table
CREATE TABLE IF NOT EXISTS xp_abuse_detection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(20) NOT NULL,
  guild_id VARCHAR(20) NOT NULL,
  detection_type VARCHAR(50) NOT NULL, -- 'spam', 'pattern', 'exploit'
  confidence DECIMAL(5,2) NOT NULL, -- 0-100
  details JSONB,
  action_taken VARCHAR(50), -- 'warned', 'xp_removed', 'multiplier_reduced'
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Streaks Table
CREATE TABLE IF NOT EXISTS xp_user_streaks (
  user_id VARCHAR(20) NOT NULL,
  guild_id VARCHAR(20) NOT NULL,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity DATE NOT NULL,
  streak_bonus_multiplier DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, guild_id)
);

-- Update guild_settings table with new XP configuration options
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_decay_enabled BOOLEAN DEFAULT false;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_abuse_detection BOOLEAN DEFAULT true;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_streak_enabled BOOLEAN DEFAULT true;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_analytics_enabled BOOLEAN DEFAULT true;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_role_rewards_enabled BOOLEAN DEFAULT true;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_channel_multipliers_enabled BOOLEAN DEFAULT true;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_weekend_bonus_enabled BOOLEAN DEFAULT true;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_weekend_multiplier DECIMAL(3,2) DEFAULT 1.5;

-- Update user_profiles table with additional tracking
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_decay_check TIMESTAMP;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS decay_amount INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS suspicious_activity_score INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_message_timestamp TIMESTAMP;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS consecutive_days INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX idx_xp_logs_user_guild ON xp_logs(user_id, guild_id, created_at DESC);
CREATE INDEX idx_xp_logs_guild_date ON xp_logs(guild_id, created_at DESC);
CREATE INDEX idx_xp_statistics_lookup ON xp_statistics(user_id, guild_id, period_type, period_start);
CREATE INDEX idx_xp_channel_multipliers_lookup ON xp_channel_multipliers(guild_id, channel_id) WHERE enabled = true;
CREATE INDEX idx_xp_role_multipliers_lookup ON xp_role_multipliers(guild_id, role_id) WHERE enabled = true;
CREATE INDEX idx_xp_user_multipliers_active ON xp_user_multipliers(user_id, guild_id) WHERE enabled = true AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
CREATE INDEX idx_level_role_rewards_lookup ON level_role_rewards(guild_id, level) WHERE enabled = true;
CREATE INDEX idx_xp_events_active ON xp_events(guild_id, start_time, end_time) WHERE enabled = true;

-- Create function to clean up expired user multipliers
CREATE OR REPLACE FUNCTION cleanup_expired_multipliers() RETURNS void AS $$
BEGIN
  UPDATE xp_user_multipliers 
  SET enabled = false 
  WHERE expires_at IS NOT NULL 
    AND expires_at < CURRENT_TIMESTAMP 
    AND enabled = true;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate total multiplier for a user
CREATE OR REPLACE FUNCTION calculate_total_multiplier(
  p_user_id VARCHAR(20),
  p_guild_id VARCHAR(20),
  p_channel_id VARCHAR(20),
  p_role_ids VARCHAR(20)[]
) RETURNS DECIMAL AS $$
DECLARE
  total_multiplier DECIMAL := 1.0;
  channel_mult DECIMAL;
  role_mult DECIMAL;
  user_mult DECIMAL;
  event_mult DECIMAL;
BEGIN
  -- Get channel multiplier
  SELECT multiplier INTO channel_mult
  FROM xp_channel_multipliers
  WHERE guild_id = p_guild_id 
    AND channel_id = p_channel_id 
    AND enabled = true;
  
  IF channel_mult IS NOT NULL THEN
    total_multiplier := total_multiplier * channel_mult;
  END IF;
  
  -- Get highest role multiplier
  SELECT MAX(multiplier) INTO role_mult
  FROM xp_role_multipliers
  WHERE guild_id = p_guild_id 
    AND role_id = ANY(p_role_ids)
    AND enabled = true;
  
  IF role_mult IS NOT NULL THEN
    total_multiplier := total_multiplier * role_mult;
  END IF;
  
  -- Get user multipliers (stack additively)
  SELECT SUM(multiplier - 1) + 1 INTO user_mult
  FROM xp_user_multipliers
  WHERE user_id = p_user_id 
    AND guild_id = p_guild_id 
    AND enabled = true
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
  
  IF user_mult IS NOT NULL THEN
    total_multiplier := total_multiplier * user_mult;
  END IF;
  
  -- Get active event multiplier
  SELECT MAX(multiplier) INTO event_mult
  FROM xp_events
  WHERE guild_id = p_guild_id 
    AND enabled = true
    AND CURRENT_TIMESTAMP BETWEEN start_time AND end_time;
  
  IF event_mult IS NOT NULL THEN
    total_multiplier := total_multiplier * event_mult;
  END IF;
  
  RETURN total_multiplier;
END;
$$ LANGUAGE plpgsql;

-- DOWN
-- Drop functions
DROP FUNCTION IF EXISTS calculate_total_multiplier;
DROP FUNCTION IF EXISTS cleanup_expired_multipliers;

-- Drop indexes
DROP INDEX IF EXISTS idx_xp_events_active;
DROP INDEX IF EXISTS idx_level_role_rewards_lookup;
DROP INDEX IF EXISTS idx_xp_user_multipliers_active;
DROP INDEX IF EXISTS idx_xp_role_multipliers_lookup;
DROP INDEX IF EXISTS idx_xp_channel_multipliers_lookup;
DROP INDEX IF EXISTS idx_xp_statistics_lookup;
DROP INDEX IF EXISTS idx_xp_logs_guild_date;
DROP INDEX IF EXISTS idx_xp_logs_user_guild;

-- Drop columns from existing tables
ALTER TABLE user_profiles DROP COLUMN IF EXISTS consecutive_days;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS last_message_timestamp;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS suspicious_activity_score;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS decay_amount;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS last_decay_check;

ALTER TABLE guild_settings DROP COLUMN IF EXISTS xp_weekend_multiplier;
ALTER TABLE guild_settings DROP COLUMN IF EXISTS xp_weekend_bonus_enabled;
ALTER TABLE guild_settings DROP COLUMN IF EXISTS xp_channel_multipliers_enabled;
ALTER TABLE guild_settings DROP COLUMN IF EXISTS xp_role_rewards_enabled;
ALTER TABLE guild_settings DROP COLUMN IF EXISTS xp_analytics_enabled;
ALTER TABLE guild_settings DROP COLUMN IF EXISTS xp_streak_enabled;
ALTER TABLE guild_settings DROP COLUMN IF EXISTS xp_abuse_detection;
ALTER TABLE guild_settings DROP COLUMN IF EXISTS xp_decay_enabled;

-- Drop tables
DROP TABLE IF EXISTS xp_user_streaks;
DROP TABLE IF EXISTS xp_abuse_detection;
DROP TABLE IF EXISTS xp_decay_config;
DROP TABLE IF EXISTS level_role_rewards;
DROP TABLE IF EXISTS xp_statistics;
DROP TABLE IF EXISTS xp_logs;
DROP TABLE IF EXISTS xp_events;
DROP TABLE IF EXISTS xp_user_multipliers;
DROP TABLE IF EXISTS xp_role_multipliers;
DROP TABLE IF EXISTS xp_channel_multipliers;