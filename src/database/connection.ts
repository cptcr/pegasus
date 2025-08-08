import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { logger } from '../utils/logger';
import * as schema from './schema';

let db: ReturnType<typeof drizzle>;
let connection: postgres.Sql;

async function createGiveawayTables() {
  try {
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

    // Create indexes
    await connection`CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_giveaways_status ON giveaways(status)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_giveaways_end_time ON giveaways(end_time)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user ON giveaway_entries(user_id)`;

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
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    await connection`CREATE INDEX IF NOT EXISTS idx_audit_logs_guild ON audit_logs(guild_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)`;

    // Add missing columns if they don't exist
    try {
      await connection`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(64)`;
      await connection`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255)`;
    } catch (err) {
      // Columns might already exist
    }

    logger.info('Giveaway and audit tables created/verified successfully');
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
    });

    // Create the drizzle instance
    db = drizzle(connection, { schema });

    // Test the connection
    await connection`SELECT 1`;

    logger.info('Database connection established successfully');

    // Create giveaways tables if they don't exist
    await createGiveawayTables();
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
