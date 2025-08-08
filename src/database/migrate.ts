import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { config } from '../config/env';
import { logger } from '../utils/logger';

async function runMigrations() {
  const client = new Client({
    connectionString: config.DATABASE_URL,
  });

  try {
    await client.connect();
    logger.info('Connected to database for migrations');

    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    logger.info(`Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      logger.info(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      try {
        await client.query(sql);
        logger.info(`✓ Migration ${file} completed successfully`);
      } catch (error) {
        logger.error(`✗ Migration ${file} failed:`, error);
        throw error;
      }
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runMigrations();
}

export { runMigrations };
