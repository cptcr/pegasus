-- Migration: Add security tables
-- Version: 5

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    action VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_guild_user ON audit_logs(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Create user permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT true,
    granted_by VARCHAR(20),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id, permission)
);

-- Create role permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    guild_id VARCHAR(20) NOT NULL,
    role_id VARCHAR(20) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT true,
    granted_by VARCHAR(20),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, role_id, permission)
);

-- Create security tokens table
CREATE TABLE IF NOT EXISTS security_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create blocked users table (for security blacklist)
CREATE TABLE IF NOT EXISTS blocked_users (
    user_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL DEFAULT '0',
    reason TEXT NOT NULL,
    blocked_by VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, guild_id)
);

-- Create rate limit overrides table
CREATE TABLE IF NOT EXISTS rate_limit_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(20) NOT NULL, -- 'user', 'role', 'channel'
    target_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20),
    command VARCHAR(50),
    max_requests INTEGER NOT NULL,
    window_seconds INTEGER NOT NULL,
    created_by VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create IP bans table
CREATE TABLE IF NOT EXISTS ip_bans (
    ip VARCHAR(45) PRIMARY KEY,
    reason TEXT NOT NULL,
    banned_by VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create security alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id VARCHAR(20) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT false,
    resolved_by VARCHAR(20),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for security tables
CREATE INDEX IF NOT EXISTS idx_user_permissions_guild ON user_permissions(guild_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_guild ON role_permissions(guild_id);
CREATE INDEX IF NOT EXISTS idx_security_tokens_user ON security_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_security_tokens_expires ON security_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_blocked_users_guild ON blocked_users(guild_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_overrides_target ON rate_limit_overrides(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_guild ON security_alerts(guild_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);

-- Create function to clean up expired data
CREATE OR REPLACE FUNCTION cleanup_expired_security_data()
RETURNS void AS $$
BEGIN
    -- Delete expired tokens
    DELETE FROM security_tokens WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Delete expired IP bans
    DELETE FROM ip_bans WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
    
    -- Delete expired user blocks
    DELETE FROM blocked_users WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
    
    -- Delete old audit logs (keep 90 days)
    DELETE FROM audit_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;