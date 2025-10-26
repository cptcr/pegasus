-- Economy System Migration
-- This migration creates all necessary tables for the economy system

-- User economy balances
CREATE TABLE IF NOT EXISTS economy_balances (
    user_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0,
    bank_balance BIGINT NOT NULL DEFAULT 0,
    total_earned BIGINT NOT NULL DEFAULT 0,
    total_spent BIGINT NOT NULL DEFAULT 0,
    total_gambled BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, guild_id)
);

CREATE INDEX IF NOT EXISTS economy_balances_user_id_idx ON economy_balances(user_id);
CREATE INDEX IF NOT EXISTS economy_balances_guild_id_idx ON economy_balances(guild_id);
CREATE INDEX IF NOT EXISTS economy_balances_balance_idx ON economy_balances(balance);

-- Transaction history
CREATE TABLE IF NOT EXISTS economy_transactions (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,
    description TEXT,
    metadata JSONB,
    related_user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS economy_transactions_user_id_idx ON economy_transactions(user_id);
CREATE INDEX IF NOT EXISTS economy_transactions_guild_id_idx ON economy_transactions(guild_id);
CREATE INDEX IF NOT EXISTS economy_transactions_type_idx ON economy_transactions(type);
CREATE INDEX IF NOT EXISTS economy_transactions_created_at_idx ON economy_transactions(created_at);

-- Shop items
CREATE TABLE IF NOT EXISTS economy_shop_items (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    effect_type VARCHAR(50),
    effect_value JSONB,
    stock INTEGER DEFAULT -1,
    requires_role VARCHAR(255),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS economy_shop_items_guild_id_idx ON economy_shop_items(guild_id);
CREATE INDEX IF NOT EXISTS economy_shop_items_enabled_idx ON economy_shop_items(enabled);
CREATE UNIQUE INDEX IF NOT EXISTS economy_shop_items_guild_name_unique ON economy_shop_items(guild_id, name);

-- User purchased items
CREATE TABLE IF NOT EXISTS economy_user_items (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    item_id VARCHAR(255) NOT NULL REFERENCES economy_shop_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS economy_user_items_user_id_idx ON economy_user_items(user_id);
CREATE INDEX IF NOT EXISTS economy_user_items_guild_id_idx ON economy_user_items(guild_id);
CREATE INDEX IF NOT EXISTS economy_user_items_item_id_idx ON economy_user_items(item_id);
CREATE INDEX IF NOT EXISTS economy_user_items_expires_at_idx ON economy_user_items(expires_at);
CREATE INDEX IF NOT EXISTS economy_user_items_active_idx ON economy_user_items(active);

-- Cooldowns for economy commands
CREATE TABLE IF NOT EXISTS economy_cooldowns (
    user_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    command_type VARCHAR(50) NOT NULL,
    last_used TIMESTAMP NOT NULL,
    next_available TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, guild_id, command_type)
);

CREATE INDEX IF NOT EXISTS economy_cooldowns_user_id_idx ON economy_cooldowns(user_id);
CREATE INDEX IF NOT EXISTS economy_cooldowns_guild_id_idx ON economy_cooldowns(guild_id);
CREATE INDEX IF NOT EXISTS economy_cooldowns_next_available_idx ON economy_cooldowns(next_available);

-- Gambling game statistics
CREATE TABLE IF NOT EXISTS economy_gambling_stats (
    user_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    games_played INTEGER NOT NULL DEFAULT 0,
    games_won INTEGER NOT NULL DEFAULT 0,
    total_wagered BIGINT NOT NULL DEFAULT 0,
    total_won BIGINT NOT NULL DEFAULT 0,
    biggest_win BIGINT NOT NULL DEFAULT 0,
    biggest_loss BIGINT NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, guild_id, game_type)
);

CREATE INDEX IF NOT EXISTS economy_gambling_stats_user_id_idx ON economy_gambling_stats(user_id);
CREATE INDEX IF NOT EXISTS economy_gambling_stats_guild_id_idx ON economy_gambling_stats(guild_id);

-- Economy settings per guild
CREATE TABLE IF NOT EXISTS economy_settings (
    guild_id VARCHAR(255) PRIMARY KEY,
    currency_symbol VARCHAR(10) NOT NULL DEFAULT '💰',
    currency_name VARCHAR(50) NOT NULL DEFAULT 'coins',
    starting_balance BIGINT NOT NULL DEFAULT 100,
    daily_amount BIGINT NOT NULL DEFAULT 100,
    daily_streak BOOLEAN NOT NULL DEFAULT TRUE,
    daily_streak_bonus BIGINT NOT NULL DEFAULT 10,
    work_min_amount BIGINT NOT NULL DEFAULT 50,
    work_max_amount BIGINT NOT NULL DEFAULT 200,
    work_cooldown INTEGER NOT NULL DEFAULT 3600,
    rob_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    rob_min_amount BIGINT NOT NULL DEFAULT 100,
    rob_success_rate INTEGER NOT NULL DEFAULT 50,
    rob_cooldown INTEGER NOT NULL DEFAULT 86400,
    rob_protection_cost BIGINT NOT NULL DEFAULT 1000,
    rob_protection_duration INTEGER NOT NULL DEFAULT 86400,
    max_bet BIGINT NOT NULL DEFAULT 10000,
    min_bet BIGINT NOT NULL DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_economy_balances_updated_at ON economy_balances;
CREATE TRIGGER update_economy_balances_updated_at BEFORE UPDATE ON economy_balances 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_economy_shop_items_updated_at ON economy_shop_items;
CREATE TRIGGER update_economy_shop_items_updated_at BEFORE UPDATE ON economy_shop_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_economy_settings_updated_at ON economy_settings;
CREATE TRIGGER update_economy_settings_updated_at BEFORE UPDATE ON economy_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_economy_gambling_stats_updated_at ON economy_gambling_stats;
CREATE TRIGGER update_economy_gambling_stats_updated_at BEFORE UPDATE ON economy_gambling_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
