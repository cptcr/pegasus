-- Additional tables for new features

-- AutoMod system
CREATE TABLE IF NOT EXISTS automod_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    action VARCHAR(20) NOT NULL,
    threshold INTEGER,
    duration INTEGER,
    whitelist TEXT[] DEFAULT '{}',
    blacklist TEXT[] DEFAULT '{}',
    exempt_roles TEXT[] DEFAULT '{}',
    exempt_channels TEXT[] DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automod_violations (
    user_id VARCHAR(20),
    guild_id VARCHAR(20),
    violation_type VARCHAR(20),
    count INTEGER DEFAULT 1,
    last_violation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, guild_id, violation_type)
);

-- Economy system
CREATE TABLE IF NOT EXISTS economy_users (
    user_id VARCHAR(20),
    guild_id VARCHAR(20),
    coins INTEGER DEFAULT 1000,
    bank INTEGER DEFAULT 0,
    bank_limit INTEGER DEFAULT 10000,
    last_daily TIMESTAMP,
    last_weekly TIMESTAMP,
    last_work TIMESTAMP,
    work_streak INTEGER DEFAULT 0,
    daily_streak INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    inventory JSONB DEFAULT '[]',
    multiplier DECIMAL(3,2) DEFAULT 1.0,
    prestige INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS shop_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    role_id VARCHAR(20),
    emoji VARCHAR(100),
    stock INTEGER DEFAULT -1,
    max_stock INTEGER DEFAULT -1,
    enabled BOOLEAN DEFAULT true,
    requirements JSONB DEFAULT '{}',
    effects JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_inventory (
    user_id VARCHAR(20),
    guild_id VARCHAR(20),
    item_id UUID,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, guild_id, item_id),
    FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS economy_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT NOT NULL,
    to_user VARCHAR(20),
    from_user VARCHAR(20),
    item_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE SET NULL
);

-- Reaction Roles system
CREATE TABLE IF NOT EXISTS reaction_role_panels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    message_id VARCHAR(20),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    color VARCHAR(7) DEFAULT '#0099ff',
    type VARCHAR(20) DEFAULT 'reaction',
    max_roles INTEGER DEFAULT 0,
    required_roles TEXT[] DEFAULT '{}',
    allowed_roles TEXT[] DEFAULT '{}',
    embed_enabled BOOLEAN DEFAULT true,
    embed_thumbnail TEXT,
    embed_image TEXT,
    embed_footer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reaction_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    panel_id UUID NOT NULL,
    role_id VARCHAR(20) NOT NULL,
    emoji VARCHAR(100),
    label VARCHAR(100) NOT NULL,
    description TEXT,
    style VARCHAR(20) DEFAULT 'Primary',
    requirements JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (panel_id) REFERENCES reaction_role_panels(id) ON DELETE CASCADE
);

-- Extended guild settings for new features
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_enabled BOOLEAN DEFAULT false;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_image BOOLEAN DEFAULT false;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_image_template VARCHAR(50) DEFAULT 'default';
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_card BOOLEAN DEFAULT false;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_card_color VARCHAR(7) DEFAULT '#7289da';
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_roles TEXT[] DEFAULT '{}';
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS goodbye_enabled BOOLEAN DEFAULT false;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS goodbye_channel VARCHAR(20);
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS goodbye_message TEXT;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS goodbye_image BOOLEAN DEFAULT false;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS dm_welcome BOOLEAN DEFAULT false;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS dm_message TEXT;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS autorole_enabled BOOLEAN DEFAULT false;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS autoroles TEXT[] DEFAULT '{}';
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_embed BOOLEAN DEFAULT true;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS embed_title TEXT;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS embed_description TEXT;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS embed_color VARCHAR(7) DEFAULT '#00ff00';
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS embed_thumbnail BOOLEAN DEFAULT true;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS embed_footer TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_automod_filters_guild ON automod_filters (guild_id, enabled);
CREATE INDEX IF NOT EXISTS idx_automod_violations_user_guild ON automod_violations (user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_economy_users_guild ON economy_users (guild_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_guild_enabled ON shop_items (guild_id, enabled);
CREATE INDEX IF NOT EXISTS idx_economy_transactions_user_guild ON economy_transactions (user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_reaction_panels_guild ON reaction_role_panels (guild_id);
CREATE INDEX IF NOT EXISTS idx_reaction_roles_panel ON reaction_roles (panel_id);