-- Migration: Enhanced moderation system
-- Version: 8

-- Add channel lockdowns table for tracking locked channels
CREATE TABLE IF NOT EXISTS channel_lockdowns (
    guild_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    moderator_id VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, channel_id)
);

-- Create indexes for channel lockdowns
CREATE INDEX IF NOT EXISTS idx_channel_lockdowns_expires ON channel_lockdowns(expires_at);
CREATE INDEX IF NOT EXISTS idx_channel_lockdowns_moderator ON channel_lockdowns(moderator_id);

-- Add AFK system table
CREATE TABLE IF NOT EXISTS user_afk (
    user_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    reason TEXT,
    set_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, guild_id)
);

-- Create indexes for AFK system
CREATE INDEX IF NOT EXISTS idx_user_afk_guild ON user_afk(guild_id);
CREATE INDEX IF NOT EXISTS idx_user_afk_set_at ON user_afk(set_at);

-- Add server settings extensions for new configuration options
ALTER TABLE guild_settings 
ADD COLUMN IF NOT EXISTS autorole_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS welcome_channel_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS welcome_message TEXT,
ADD COLUMN IF NOT EXISTS welcome_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS autorole_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS moderation_log_channel_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS join_log_channel_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS leave_log_channel_id VARCHAR(20);

-- Add permission levels table for custom permission system
CREATE TABLE IF NOT EXISTS permission_levels (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    level INTEGER NOT NULL DEFAULT 0, -- 0: User, 1: Helper, 2: Moderator, 3: Admin, 4: Owner
    assigned_by VARCHAR(20) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
);

-- Create indexes for permission levels
CREATE INDEX IF NOT EXISTS idx_permission_levels_guild ON permission_levels(guild_id);
CREATE INDEX IF NOT EXISTS idx_permission_levels_level ON permission_levels(level);

-- Add user notes table for moderator notes
CREATE TABLE IF NOT EXISTS user_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    moderator_id VARCHAR(20) NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for user notes
CREATE INDEX IF NOT EXISTS idx_user_notes_guild_user ON user_notes(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_moderator ON user_notes(moderator_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_created ON user_notes(created_at DESC);

-- Add server invites tracking table
CREATE TABLE IF NOT EXISTS server_invites (
    guild_id VARCHAR(20) NOT NULL,
    invite_code VARCHAR(20) NOT NULL,
    creator_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    max_uses INTEGER DEFAULT 0,
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    temporary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, invite_code)
);

-- Create indexes for server invites
CREATE INDEX IF NOT EXISTS idx_server_invites_creator ON server_invites(creator_id);
CREATE INDEX IF NOT EXISTS idx_server_invites_expires ON server_invites(expires_at);

-- Add command cooldowns table for advanced rate limiting
CREATE TABLE IF NOT EXISTS command_cooldowns (
    user_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    command_name VARCHAR(50) NOT NULL,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, guild_id, command_name)
);

-- Create indexes for command cooldowns
CREATE INDEX IF NOT EXISTS idx_command_cooldowns_last_used ON command_cooldowns(last_used);

-- Add automod settings table
CREATE TABLE IF NOT EXISTS automod_settings (
    guild_id VARCHAR(20) PRIMARY KEY,
    enabled BOOLEAN DEFAULT false,
    anti_spam BOOLEAN DEFAULT false,
    anti_raid BOOLEAN DEFAULT false,
    filter_links BOOLEAN DEFAULT false,
    filter_invites BOOLEAN DEFAULT false,
    filter_caps BOOLEAN DEFAULT false,
    filter_words JSONB DEFAULT '[]',
    whitelist_channels JSONB DEFAULT '[]',
    whitelist_roles JSONB DEFAULT '[]',
    action_warn BOOLEAN DEFAULT true,
    action_mute BOOLEAN DEFAULT false,
    action_kick BOOLEAN DEFAULT false,
    action_ban BOOLEAN DEFAULT false,
    max_warnings INTEGER DEFAULT 3,
    punishment_duration INTEGER DEFAULT 600, -- in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add temporary bans table for timed bans
CREATE TABLE IF NOT EXISTS temporary_bans (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    moderator_id VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
);

-- Create indexes for temporary bans
CREATE INDEX IF NOT EXISTS idx_temporary_bans_expires ON temporary_bans(expires_at);
CREATE INDEX IF NOT EXISTS idx_temporary_bans_moderator ON temporary_bans(moderator_id);

-- Update mod_actions table to ensure it has all necessary columns
ALTER TABLE mod_actions 
ADD COLUMN IF NOT EXISTS channel_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create function to clean up expired moderation data
CREATE OR REPLACE FUNCTION cleanup_expired_moderation_data()
RETURNS void AS $$
BEGIN
    -- Remove expired channel lockdowns
    DELETE FROM channel_lockdowns WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
    
    -- Remove expired temporary bans
    DELETE FROM temporary_bans WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Clean up old command cooldowns (older than 1 day)
    DELETE FROM command_cooldowns WHERE last_used < CURRENT_TIMESTAMP - INTERVAL '1 day';
    
    -- Clean up old AFK entries (older than 30 days)
    DELETE FROM user_afk WHERE set_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
CREATE TRIGGER update_mod_actions_updated_at 
    BEFORE UPDATE ON mod_actions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notes_updated_at 
    BEFORE UPDATE ON user_notes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automod_settings_updated_at 
    BEFORE UPDATE ON automod_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();