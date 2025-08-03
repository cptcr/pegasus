-- Migration: Extended Guild Settings for Comprehensive Configuration
-- This migration extends the guild_settings table to support all configuration options

-- Add XP configuration columns
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_per_message INTEGER DEFAULT 5;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_per_voice_minute INTEGER DEFAULT 10;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_cooldown INTEGER DEFAULT 60; -- seconds between XP gains
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_announce_level_up BOOLEAN DEFAULT true;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_booster_role VARCHAR(20);
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_booster_multiplier INTEGER DEFAULT 200; -- percentage (200 = 2x)

-- Add autorole configuration
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS autorole_enabled BOOLEAN DEFAULT false;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS autorole_roles JSONB DEFAULT '[]'::jsonb; -- Array of role IDs

-- Add welcome message configuration (extending existing)
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_embed_enabled BOOLEAN DEFAULT false;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_embed_color VARCHAR(7) DEFAULT '#0099FF';
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_embed_title VARCHAR(255);
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_embed_image VARCHAR(500);
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_embed_thumbnail VARCHAR(500);
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_dm_enabled BOOLEAN DEFAULT false;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_dm_message TEXT;

-- Add goodbye message configuration (extending existing)
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS goodbye_embed_enabled BOOLEAN DEFAULT false;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS goodbye_embed_color VARCHAR(7) DEFAULT '#FF0000';
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS goodbye_embed_title VARCHAR(255);
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS goodbye_embed_image VARCHAR(500);
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS goodbye_embed_thumbnail VARCHAR(500);

-- Create XP settings table for more complex configurations
CREATE TABLE IF NOT EXISTS xp_settings (
    guild_id VARCHAR(20) PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
    ignored_channels JSONB DEFAULT '[]'::jsonb,
    ignored_roles JSONB DEFAULT '[]'::jsonb,
    no_xp_channels JSONB DEFAULT '[]'::jsonb,
    double_xp_channels JSONB DEFAULT '[]'::jsonb,
    role_multipliers JSONB DEFAULT '{}'::jsonb, -- { "roleId": multiplier }
    level_up_rewards_enabled BOOLEAN DEFAULT true,
    stack_role_rewards BOOLEAN DEFAULT false, -- whether to keep old role rewards when leveling up
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_guild_settings_xp_enabled ON guild_settings(xp_enabled);
CREATE INDEX IF NOT EXISTS idx_guild_settings_autorole_enabled ON guild_settings(autorole_enabled);
CREATE INDEX IF NOT EXISTS idx_xp_rewards_guild_level ON xp_rewards(guild_id, level);
CREATE INDEX IF NOT EXISTS idx_xp_multipliers_guild_target ON xp_multipliers(guild_id, target_type, target_id);

-- Update timestamp trigger for xp_settings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_xp_settings_updated_at BEFORE UPDATE ON xp_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();