import { Pool, Client } from 'pg';
import { config } from '../utils/config';
import { secureQuery } from '../handlers/security';

export class Database {
  private pool: Pool;
  private static instance: Database;

  private constructor() {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Apply security wrapper to the pool
    secureQuery(this.pool);

    this.pool.on('error', (err) => {
      console.error('Database connection error:', err);
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  public async transaction<T>(callback: (client: Client) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client as any);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public async init(): Promise<void> {
    await this.createTables();
  }

  private async createTables(): Promise<void> {
    const queries = [
      `
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
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
      `,
      `
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
      `,
      `
      DROP TABLE IF EXISTS tickets CASCADE;
      `,
      `
      CREATE TABLE IF NOT EXISTS tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        panel_id UUID NOT NULL,
        subject VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'open',
        priority VARCHAR(20) DEFAULT 'medium',
        assigned_to VARCHAR(20),
        closed_by VARCHAR(20),
        closed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS ticket_panels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        message_id VARCHAR(20),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        color VARCHAR(7) DEFAULT '#0099ff',
        category VARCHAR(20) NOT NULL,
        support_roles TEXT[] DEFAULT '{}',
        max_tickets INTEGER DEFAULT 1,
        cooldown INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS temp_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        owner_id VARCHAR(20) NOT NULL,
        parent_id VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS game_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        game_type VARCHAR(20) NOT NULL,
        host_id VARCHAR(20) NOT NULL,
        participants TEXT[] DEFAULT '{}',
        scores JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'waiting',
        current_question JSONB,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS guild_stats (
        guild_id VARCHAR(20),
        total_messages INTEGER DEFAULT 0,
        total_commands INTEGER DEFAULT 0,
        total_voice_time INTEGER DEFAULT 0,
        total_members INTEGER DEFAULT 0,
        active_members INTEGER DEFAULT 0,
        new_members INTEGER DEFAULT 0,
        left_members INTEGER DEFAULT 0,
        banned_members INTEGER DEFAULT 0,
        kicked_members INTEGER DEFAULT 0,
        muted_members INTEGER DEFAULT 0,
        warned_members INTEGER DEFAULT 0,
        tickets_created INTEGER DEFAULT 0,
        tickets_closed INTEGER DEFAULT 0,
        date DATE DEFAULT CURRENT_DATE,
        PRIMARY KEY (guild_id, date)
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS log_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(20) NOT NULL,
        type VARCHAR(50) NOT NULL,
        user_id VARCHAR(20),
        channel_id VARCHAR(20),
        role_id VARCHAR(20),
        data JSONB NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS voice_sessions (
        user_id VARCHAR(20),
        guild_id VARCHAR(20),
        channel_id VARCHAR(20),
        join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        leave_time TIMESTAMP,
        duration INTEGER,
        afk BOOLEAN DEFAULT false,
        muted BOOLEAN DEFAULT false,
        deafened BOOLEAN DEFAULT false,
        PRIMARY KEY (user_id, guild_id, join_time)
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS user_languages (
        user_id VARCHAR(20) PRIMARY KEY,
        language VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS automod_filters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(20) NOT NULL,
        type VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        threshold INTEGER,
        duration INTEGER,
        priority INTEGER DEFAULT 1,
        whitelist TEXT[],
        blacklist TEXT[],
        exempt_roles VARCHAR(20)[],
        exempt_channels VARCHAR(20)[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
      ALTER TABLE guild_settings 
      ADD COLUMN IF NOT EXISTS welcome_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS welcome_card JSONB;
      `,
      `
      DROP TABLE IF EXISTS giveaway_winners;
      `,
      `
      DROP TABLE IF EXISTS giveaway_entries;
      `,
      `
      DROP TABLE IF EXISTS giveaways;
      `,
      `
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
        blacklist VARCHAR(20)[],
        whitelist VARCHAR(20)[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS giveaway_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
        user_id VARCHAR(20) NOT NULL,
        entry_count INTEGER DEFAULT 1,
        entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        bonus_reason TEXT,
        UNIQUE(giveaway_id, user_id)
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS giveaway_winners (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
        user_id VARCHAR(20) NOT NULL,
        claimed BOOLEAN DEFAULT false,
        claim_time TIMESTAMP,
        rerolled BOOLEAN DEFAULT false,
        selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS log_channels (
        guild_id VARCHAR(20) NOT NULL,
        category VARCHAR(50) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, category)
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS warning_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        warning_id UUID NOT NULL,
        field_changed VARCHAR(50) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by VARCHAR(20) NOT NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reason TEXT
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS moderation_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        moderator_id VARCHAR(20) NOT NULL,
        note TEXT NOT NULL,
        internal BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS economy_users (
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        coins BIGINT DEFAULT 0,
        bank BIGINT DEFAULT 0,
        bank_limit BIGINT DEFAULT 10000,
        total_earned BIGINT DEFAULT 0,
        total_spent BIGINT DEFAULT 0,
        daily_streak INTEGER DEFAULT 0,
        work_streak INTEGER DEFAULT 0,
        last_daily DATE,
        last_work TIMESTAMP,
        multiplier DECIMAL(3,2) DEFAULT 1.00,
        prestige INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS shop_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price BIGINT NOT NULL,
        type VARCHAR(50) NOT NULL,
        data JSONB DEFAULT '{}',
        stock INTEGER DEFAULT -1,
        role_id VARCHAR(20),
        requirements JSONB DEFAULT '{}',
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS user_inventory (
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        item_id UUID NOT NULL,
        quantity INTEGER DEFAULT 1,
        acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, guild_id, item_id),
        FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS automod_violations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        message_id VARCHAR(20),
        filter_id UUID NOT NULL,
        filter_type VARCHAR(50) NOT NULL,
        action_taken VARCHAR(50) NOT NULL,
        content TEXT,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS reminders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20),
        channel_id VARCHAR(20),
        message TEXT NOT NULL,
        remind_at TIMESTAMP NOT NULL,
        recurring BOOLEAN DEFAULT false,
        interval_minutes INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `,
    ];

    for (const query of queries) {
      await this.query(query);
    }

    console.log('Database tables created successfully');
  }
}

export const db = Database.getInstance();