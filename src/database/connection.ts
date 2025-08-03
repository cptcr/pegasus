import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { logger } from '../utils/logger';
import * as schema from './schema';

let db: ReturnType<typeof drizzle>;
let connection: postgres.Sql;

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

// Re-export for convenience
export { db };