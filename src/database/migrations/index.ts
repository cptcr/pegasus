import { Pool } from 'pg';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../utils/logger';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

export class MigrationRunner {
  private migrations: Migration[] = [];
  
  constructor(private pool: Pool) {}
  
  async initialize(): Promise<void> {
    // Create migrations table if it doesn't exist
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Load all migration files
    await this.loadMigrations();
  }
  
  private async loadMigrations(): Promise<void> {
    const migrationsDir = join(__dirname);
    const files = await readdir(migrationsDir);
    
    const migrationFiles = files
      .filter(file => file.match(/^\d{3}_.*\.sql$/))
      .sort();
    
    for (const file of migrationFiles) {
      const content = await readFile(join(migrationsDir, file), 'utf-8');
      const [version, ...nameParts] = file.replace('.sql', '').split('_');
      const name = nameParts.join('_');
      
      // Split UP and DOWN sections
      const sections = content.split('-- DOWN');
      const up = sections[0].replace('-- UP', '').trim();
      const down = sections[1]?.trim() || '';
      
      this.migrations.push({
        version: parseInt(version),
        name,
        up,
        down,
      });
    }
    
    logger.info(`Loaded ${this.migrations.length} migrations`);
  }
  
  async getCurrentVersion(): Promise<number> {
    const result = await this.pool.query(
      'SELECT MAX(version) as version FROM migrations'
    );
    return result.rows[0]?.version || 0;
  }
  
  async migrate(targetVersion?: number): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const target = targetVersion ?? Math.max(...this.migrations.map(m => m.version));
    
    logger.info(`Current migration version: ${currentVersion}, target: ${target}`);
    
    if (currentVersion === target) {
      logger.info('Database is already up to date');
      return;
    }
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      if (currentVersion < target) {
        // Migrate up
        const migrationsToRun = this.migrations
          .filter(m => m.version > currentVersion && m.version <= target)
          .sort((a, b) => a.version - b.version);
        
        for (const migration of migrationsToRun) {
          logger.info(`Running migration ${migration.version}: ${migration.name}`);
          
          await client.query(migration.up);
          await client.query(
            'INSERT INTO migrations (version, name) VALUES ($1, $2)',
            [migration.version, migration.name]
          );
          
          logger.info(`Completed migration ${migration.version}`);
        }
      } else {
        // Migrate down
        const migrationsToRollback = this.migrations
          .filter(m => m.version <= currentVersion && m.version > target)
          .sort((a, b) => b.version - a.version);
        
        for (const migration of migrationsToRollback) {
          logger.info(`Rolling back migration ${migration.version}: ${migration.name}`);
          
          await client.query(migration.down);
          await client.query(
            'DELETE FROM migrations WHERE version = $1',
            [migration.version]
          );
          
          logger.info(`Rolled back migration ${migration.version}`);
        }
      }
      
      await client.query('COMMIT');
      logger.info('Migration completed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Migration failed', error as Error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  async status(): Promise<{ applied: Migration[]; pending: Migration[] }> {
    const currentVersion = await this.getCurrentVersion();
    
    const appliedVersions = await this.pool.query(
      'SELECT version FROM migrations ORDER BY version'
    );
    const appliedSet = new Set(appliedVersions.rows.map(r => r.version));
    
    const applied = this.migrations.filter(m => appliedSet.has(m.version));
    const pending = this.migrations.filter(m => !appliedSet.has(m.version));
    
    return { applied, pending };
  }
}