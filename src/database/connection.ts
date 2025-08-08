import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { logger } from '../utils/logger';
import * as schema from './schema';

let db: ReturnType<typeof drizzle>;
let connection: postgres.Sql;

async function createAllTables() {
  try {
    // Create users table
    await connection`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(20) PRIMARY KEY,
        global_name VARCHAR(32),
        username VARCHAR(32) NOT NULL,
        discriminator VARCHAR(4) NOT NULL,
        avatar VARCHAR(64),
        avatar_url VARCHAR(255),
        bot BOOLEAN DEFAULT FALSE NOT NULL,
        rank_card_data TEXT,
        preferred_locale VARCHAR(5) DEFAULT 'en',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create guilds table
    await connection`
      CREATE TABLE IF NOT EXISTS guilds (
        id VARCHAR(20) PRIMARY KEY,
        prefix VARCHAR(10) DEFAULT '!' NOT NULL,
        language VARCHAR(5) DEFAULT 'en' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create guild_settings table
    await connection`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id VARCHAR(20) PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
        welcome_enabled BOOLEAN DEFAULT FALSE NOT NULL,
        welcome_channel VARCHAR(20),
        welcome_message TEXT,
        welcome_embed_enabled BOOLEAN DEFAULT FALSE NOT NULL,
        welcome_embed_color VARCHAR(7) DEFAULT '#0099FF',
        welcome_embed_title VARCHAR(255),
        welcome_embed_image VARCHAR(500),
        welcome_embed_thumbnail VARCHAR(500),
        welcome_dm_enabled BOOLEAN DEFAULT FALSE NOT NULL,
        welcome_dm_message TEXT,
        goodbye_enabled BOOLEAN DEFAULT FALSE NOT NULL,
        goodbye_channel VARCHAR(20),
        goodbye_message TEXT,
        goodbye_embed_enabled BOOLEAN DEFAULT FALSE NOT NULL,
        goodbye_embed_color VARCHAR(7) DEFAULT '#FF0000',
        goodbye_embed_title VARCHAR(255),
        goodbye_embed_image VARCHAR(500),
        goodbye_embed_thumbnail VARCHAR(500),
        logs_enabled BOOLEAN DEFAULT FALSE NOT NULL,
        logs_channel VARCHAR(20),
        xp_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        xp_rate INTEGER DEFAULT 1 NOT NULL,
        xp_per_message INTEGER DEFAULT 5 NOT NULL,
        xp_per_voice_minute INTEGER DEFAULT 10 NOT NULL,
        xp_cooldown INTEGER DEFAULT 60 NOT NULL,
        xp_announce_level_up BOOLEAN DEFAULT TRUE NOT NULL,
        xp_booster_role VARCHAR(20),
        xp_booster_multiplier INTEGER DEFAULT 200 NOT NULL,
        level_up_message TEXT,
        level_up_channel VARCHAR(20),
        autorole_enabled BOOLEAN DEFAULT FALSE NOT NULL,
        autorole_roles TEXT DEFAULT '[]' NOT NULL,
        security_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        security_alert_role VARCHAR(20),
        anti_raid_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        anti_spam_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        max_mentions INTEGER DEFAULT 5 NOT NULL,
        max_duplicates INTEGER DEFAULT 3 NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create members table
    await connection`
      CREATE TABLE IF NOT EXISTS members (
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        nickname VARCHAR(32),
        joined_at TIMESTAMP NOT NULL,
        xp INTEGER DEFAULT 0 NOT NULL,
        level INTEGER DEFAULT 0 NOT NULL,
        messages INTEGER DEFAULT 0 NOT NULL,
        voice_minutes INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (user_id, guild_id)
      )
    `;

    // Create moderation tables
    await connection`
      CREATE TABLE IF NOT EXISTS mod_cases (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        moderator_id VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL NOT NULL,
        type VARCHAR(20) NOT NULL,
        reason TEXT,
        duration INTEGER,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS warnings (
        id SERIAL PRIMARY KEY,
        warn_id VARCHAR(20) UNIQUE NOT NULL,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        moderator_id VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        level INTEGER DEFAULT 1 NOT NULL,
        proof TEXT,
        active BOOLEAN DEFAULT TRUE NOT NULL,
        edited_at TIMESTAMP,
        edited_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS warning_automations (
        id SERIAL PRIMARY KEY,
        automation_id VARCHAR(20) UNIQUE NOT NULL,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        trigger_type VARCHAR(50) NOT NULL,
        trigger_value INTEGER NOT NULL,
        actions JSONB NOT NULL,
        enabled BOOLEAN DEFAULT TRUE NOT NULL,
        created_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_triggered_at TIMESTAMP
      )
    `;

    // Create XP tables
    await connection`
      CREATE TABLE IF NOT EXISTS user_xp (
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        xp INTEGER DEFAULT 0 NOT NULL,
        level INTEGER DEFAULT 0 NOT NULL,
        last_xp_gain TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_voice_activity TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (user_id, guild_id)
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS xp_rewards (
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        level INTEGER NOT NULL,
        role_id VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS xp_multipliers (
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        target_id VARCHAR(20) NOT NULL,
        target_type VARCHAR(10) NOT NULL,
        multiplier INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS xp_settings (
        guild_id VARCHAR(20) PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
        ignored_channels TEXT DEFAULT '[]' NOT NULL,
        ignored_roles TEXT DEFAULT '[]' NOT NULL,
        no_xp_channels TEXT DEFAULT '[]' NOT NULL,
        double_xp_channels TEXT DEFAULT '[]' NOT NULL,
        role_multipliers TEXT DEFAULT '{}' NOT NULL,
        level_up_rewards_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        stack_role_rewards BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create economy tables
    await connection`
      CREATE TABLE IF NOT EXISTS economy_balances (
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        balance BIGINT DEFAULT 0 NOT NULL,
        bank_balance BIGINT DEFAULT 0 NOT NULL,
        total_earned BIGINT DEFAULT 0 NOT NULL,
        total_spent BIGINT DEFAULT 0 NOT NULL,
        total_gambled BIGINT DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (user_id, guild_id)
      )
    `;

    await connection`
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
      )
    `;

    await connection`
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
        enabled BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(guild_id, name)
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS economy_user_items (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        item_id VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 1 NOT NULL,
        purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        expires_at TIMESTAMP,
        active BOOLEAN DEFAULT TRUE NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS economy_cooldowns (
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        command_type VARCHAR(50) NOT NULL,
        last_used TIMESTAMP NOT NULL,
        next_available TIMESTAMP NOT NULL,
        PRIMARY KEY (user_id, guild_id, command_type)
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS economy_gambling_stats (
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        game_type VARCHAR(50) NOT NULL,
        games_played INTEGER DEFAULT 0 NOT NULL,
        games_won INTEGER DEFAULT 0 NOT NULL,
        total_wagered BIGINT DEFAULT 0 NOT NULL,
        total_won BIGINT DEFAULT 0 NOT NULL,
        biggest_win BIGINT DEFAULT 0 NOT NULL,
        biggest_loss BIGINT DEFAULT 0 NOT NULL,
        current_streak INTEGER DEFAULT 0 NOT NULL,
        best_streak INTEGER DEFAULT 0 NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (user_id, guild_id, game_type)
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS economy_settings (
        guild_id VARCHAR(255) PRIMARY KEY,
        currency_symbol VARCHAR(10) DEFAULT '💰' NOT NULL,
        currency_name VARCHAR(50) DEFAULT 'coins' NOT NULL,
        starting_balance BIGINT DEFAULT 100 NOT NULL,
        daily_amount BIGINT DEFAULT 100 NOT NULL,
        daily_streak BOOLEAN DEFAULT TRUE NOT NULL,
        daily_streak_bonus BIGINT DEFAULT 10 NOT NULL,
        work_min_amount BIGINT DEFAULT 50 NOT NULL,
        work_max_amount BIGINT DEFAULT 200 NOT NULL,
        work_cooldown INTEGER DEFAULT 3600 NOT NULL,
        rob_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        rob_min_amount BIGINT DEFAULT 100 NOT NULL,
        rob_success_rate INTEGER DEFAULT 50 NOT NULL,
        rob_cooldown INTEGER DEFAULT 86400 NOT NULL,
        rob_protection_cost BIGINT DEFAULT 1000 NOT NULL,
        rob_protection_duration INTEGER DEFAULT 86400 NOT NULL,
        max_bet BIGINT DEFAULT 10000 NOT NULL,
        min_bet BIGINT DEFAULT 10 NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create ticket tables
    await connection`
      CREATE TABLE IF NOT EXISTS ticket_panels (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        panel_id VARCHAR(20) UNIQUE NOT NULL,
        title VARCHAR(256) NOT NULL,
        description TEXT NOT NULL,
        image_url VARCHAR(512),
        footer VARCHAR(256),
        button_label VARCHAR(80) DEFAULT 'Create Ticket' NOT NULL,
        button_style INTEGER DEFAULT 1 NOT NULL,
        support_roles JSONB DEFAULT '[]' NOT NULL,
        category_id VARCHAR(20),
        ticket_name_format VARCHAR(100) DEFAULT 'ticket-{number}' NOT NULL,
        max_tickets_per_user INTEGER DEFAULT 1 NOT NULL,
        welcome_message TEXT,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        message_id VARCHAR(20),
        channel_id VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS tickets (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
        panel_id UUID REFERENCES ticket_panels(id) ON DELETE SET NULL,
        ticket_number INTEGER NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'open' NOT NULL,
        claimed_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        closed_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        closed_reason TEXT,
        closed_at TIMESTAMP,
        locked_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        locked_at TIMESTAMP,
        frozen_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        frozen_at TIMESTAMP,
        transcript TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
        user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        content TEXT NOT NULL,
        attachments JSONB DEFAULT '[]' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create giveaways table if it doesn't exist
    await connection`
      CREATE TABLE IF NOT EXISTS giveaways (
        giveaway_id VARCHAR(20) PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        message_id VARCHAR(20),
        hosted_by VARCHAR(20) NOT NULL,
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
      )
    `;

    // Create giveaway_entries table if it doesn't exist
    await connection`
      CREATE TABLE IF NOT EXISTS giveaway_entries (
        giveaway_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        entries INTEGER DEFAULT 1 NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (giveaway_id, user_id)
      )
    `;

    // Create audit_logs table
    await connection`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20),
        user_id VARCHAR(20),
        action VARCHAR(100) NOT NULL,
        target_id VARCHAR(20),
        target_type VARCHAR(50),
        details JSON,
        ip_hash VARCHAR(64),
        user_agent VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create blacklist table
    await connection`
      CREATE TABLE IF NOT EXISTS blacklist (
        user_id VARCHAR(20) PRIMARY KEY,
        moderator_id VARCHAR(20) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create indexes for better performance
    await connection`CREATE INDEX IF NOT EXISTS idx_members_guild ON members(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_members_xp ON members(guild_id, xp DESC)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_user_xp_guild ON user_xp(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_user_xp_combined ON user_xp(guild_id, xp DESC)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_warnings_guild ON warnings(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_giveaways_status ON giveaways(status)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_giveaways_end_time ON giveaways(end_time)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user ON giveaway_entries(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_audit_logs_guild ON audit_logs(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_balances_user ON economy_balances(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_balances_guild ON economy_balances(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_balances_balance ON economy_balances(balance)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_transactions_user ON economy_transactions(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_transactions_guild ON economy_transactions(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_transactions_type ON economy_transactions(type)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_transactions_created_at ON economy_transactions(created_at)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_shop_items_guild ON economy_shop_items(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_shop_items_enabled ON economy_shop_items(enabled)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_user_items_user ON economy_user_items(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_user_items_guild ON economy_user_items(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_user_items_item ON economy_user_items(item_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_user_items_expires_at ON economy_user_items(expires_at)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_user_items_active ON economy_user_items(active)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_cooldowns_user ON economy_cooldowns(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_cooldowns_guild ON economy_cooldowns(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_cooldowns_next_available ON economy_cooldowns(next_available)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_gambling_stats_user ON economy_gambling_stats(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_economy_gambling_stats_guild ON economy_gambling_stats(guild_id)`;

    logger.info('All database tables created/verified successfully');
  } catch (error) {
    logger.warn('Could not create tables (they may already exist):', error);
  }
}

export async function initializeDatabase() {
  try {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Create the connection
    connection = postgres(connectionString, {
      max: 10, // Maximum number of connections
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {}, // Suppress NOTICE messages
    });

    // Create the drizzle instance
    db = drizzle(connection, { schema });

    // Test the connection
    await connection`SELECT 1`;

    logger.info('Database connection established successfully');

    // Create all database tables if they don't exist
    await createAllTables();
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function closeDatabase() {
  if (connection) {
    await connection.end();
    logger.info('Database connection closed');
  }
}

// Export db as a getter function since it may not be initialized immediately
export { getDatabase as db };
