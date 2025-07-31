import { exec } from 'child_process';
import { promisify } from 'util';
import { createWriteStream, createReadStream, existsSync, mkdirSync } from 'fs';
import { readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { config } from '../config';
import { logger } from './logger';
import { db } from '../database/connection';

const execAsync = promisify(exec);

export class BackupManager {
  private backupInterval?: NodeJS.Timeout;
  private isRunning = false;
  
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('Starting backup manager');
    
    // Ensure backup directory exists
    if (!existsSync(config.BACKUP_PATH)) {
      mkdirSync(config.BACKUP_PATH, { recursive: true });
    }
    
    // Perform initial backup
    await this.performBackup();
    
    // Schedule regular backups
    const intervalMs = config.BACKUP_INTERVAL_HOURS * 60 * 60 * 1000;
    this.backupInterval = setInterval(() => {
      this.performBackup().catch(error => {
        logger.error('Scheduled backup failed', error);
      });
    }, intervalMs);
  }
  
  stop(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = undefined;
    }
    this.isRunning = false;
    logger.info('Backup manager stopped');
  }
  
  async performBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupPath = join(config.BACKUP_PATH, backupName);
    
    logger.info('Starting backup', { backupName });
    const startTime = Date.now();
    
    try {
      // Create backup directory
      mkdirSync(backupPath, { recursive: true });
      
      // Backup database
      await this.backupDatabase(backupPath);
      
      // Backup configuration files
      await this.backupConfigFiles(backupPath);
      
      // Backup logs (last 7 days)
      await this.backupLogs(backupPath);
      
      // Compress backup
      const archivePath = `${backupPath}.tar.gz`;
      await this.compressBackup(backupPath, archivePath);
      
      // Clean up uncompressed backup
      await execAsync(`rm -rf ${backupPath}`);
      
      // Clean old backups
      await this.cleanOldBackups();
      
      const duration = Date.now() - startTime;
      logger.info('Backup completed', { backupName, duration });
      logger.audit('BACKUP_CREATED', 'system', 'system', { backupName, duration });
      
      return archivePath;
    } catch (error) {
      logger.error('Backup failed', error as Error, { backupName });
      
      // Clean up failed backup
      try {
        await execAsync(`rm -rf ${backupPath} ${backupPath}.tar.gz`);
      } catch (cleanupError) {
        logger.error('Failed to clean up backup', cleanupError as Error);
      }
      
      throw error;
    }
  }
  
  private async backupDatabase(backupPath: string): Promise<void> {
    const dbUrl = new URL(config.DATABASE_URL);
    const dbConfig = {
      host: dbUrl.hostname,
      port: dbUrl.port || '5432',
      database: dbUrl.pathname.slice(1),
      username: dbUrl.username,
      password: dbUrl.password,
    };
    
    const dumpFile = join(backupPath, 'database.sql');
    
    // Use pg_dump to create database backup
    const pgDumpCommand = `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f ${dumpFile} --no-owner --clean --if-exists`;
    
    try {
      await execAsync(pgDumpCommand);
      
      // Compress the SQL dump
      await pipeline(
        createReadStream(dumpFile),
        createGzip(),
        createWriteStream(`${dumpFile}.gz`)
      );
      
      // Remove uncompressed dump
      await unlink(dumpFile);
      
      logger.info('Database backup completed');
    } catch (error) {
      // If pg_dump is not available, fall back to SQL export
      logger.warn('pg_dump failed, using SQL export fallback', { error });
      await this.exportDatabaseTables(backupPath);
    }
  }
  
  private async exportDatabaseTables(backupPath: string): Promise<void> {
    const tables = [
      'guild_settings',
      'user_profiles',
      'mod_actions',
      'tickets',
      'ticket_panels',
      'temp_channels',
      'game_sessions',
      'guild_stats',
      'log_events',
      'voice_sessions',
      'user_languages',
      'automod_filters',
      'giveaways',
      'giveaway_entries',
      'giveaway_winners',
      'log_channels',
      'warning_history',
      'moderation_notes',
      'economy_users',
      'shop_items',
      'user_inventory',
      'automod_violations',
      'reminders',
      'guild_commands',
      'discord_entitlements',
      'subscription_status',
      'premium_guilds',
      'custom_commands',
    ];
    
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT * FROM ${table}`);
        if (result.rows.length > 0) {
          const jsonPath = join(backupPath, `${table}.json`);
          const data = JSON.stringify(result.rows, null, 2);
          
          await pipeline(
            createReadStream(Buffer.from(data)),
            createGzip(),
            createWriteStream(`${jsonPath}.gz`)
          );
        }
      } catch (error) {
        logger.warn(`Failed to export table ${table}`, { error });
      }
    }
  }
  
  private async backupConfigFiles(backupPath: string): Promise<void> {
    const configFiles = [
      'config.json',
      '.env',
      'package.json',
      'tsconfig.json',
    ];
    
    const configBackupPath = join(backupPath, 'config');
    mkdirSync(configBackupPath, { recursive: true });
    
    for (const file of configFiles) {
      const filePath = join(process.cwd(), file);
      if (existsSync(filePath)) {
        try {
          await execAsync(`cp ${filePath} ${configBackupPath}/`);
        } catch (error) {
          logger.warn(`Failed to backup config file ${file}`, { error });
        }
      }
    }
  }
  
  private async backupLogs(backupPath: string): Promise<void> {
    const logsPath = join(process.cwd(), 'logs');
    const logsBackupPath = join(backupPath, 'logs');
    
    if (!existsSync(logsPath)) return;
    
    mkdirSync(logsBackupPath, { recursive: true });
    
    // Get logs from last 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const files = await readdir(logsPath);
    
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = join(logsPath, file);
        const stats = await stat(filePath);
        
        if (stats.mtimeMs >= sevenDaysAgo) {
          try {
            await pipeline(
              createReadStream(filePath),
              createGzip(),
              createWriteStream(join(logsBackupPath, `${file}.gz`))
            );
          } catch (error) {
            logger.warn(`Failed to backup log file ${file}`, { error });
          }
        }
      }
    }
  }
  
  private async compressBackup(sourcePath: string, targetPath: string): Promise<void> {
    await execAsync(`tar -czf ${targetPath} -C ${join(sourcePath, '..')} ${sourcePath.split('/').pop()}`);
  }
  
  private async cleanOldBackups(): Promise<void> {
    const files = await readdir(config.BACKUP_PATH);
    const cutoffTime = Date.now() - (config.BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    
    for (const file of files) {
      if (file.startsWith('backup-') && file.endsWith('.tar.gz')) {
        const filePath = join(config.BACKUP_PATH, file);
        const stats = await stat(filePath);
        
        if (stats.mtimeMs < cutoffTime) {
          try {
            await unlink(filePath);
            logger.info('Deleted old backup', { file });
          } catch (error) {
            logger.error('Failed to delete old backup', error as Error, { file });
          }
        }
      }
    }
  }
  
  async listBackups(): Promise<Array<{ name: string; size: number; created: Date }>> {
    const files = await readdir(config.BACKUP_PATH);
    const backups = [];
    
    for (const file of files) {
      if (file.startsWith('backup-') && file.endsWith('.tar.gz')) {
        const filePath = join(config.BACKUP_PATH, file);
        const stats = await stat(filePath);
        
        backups.push({
          name: file,
          size: stats.size,
          created: new Date(stats.birthtime),
        });
      }
    }
    
    return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
  }
  
  async restoreBackup(backupName: string): Promise<void> {
    const backupPath = join(config.BACKUP_PATH, backupName);
    
    if (!existsSync(backupPath)) {
      throw new Error(`Backup ${backupName} not found`);
    }
    
    logger.warn('Starting backup restoration', { backupName });
    
    try {
      // Extract backup
      const tempPath = join(config.BACKUP_PATH, 'restore-temp');
      await execAsync(`mkdir -p ${tempPath}`);
      await execAsync(`tar -xzf ${backupPath} -C ${tempPath}`);
      
      // Find the extracted backup directory
      const extractedDirs = await readdir(tempPath);
      const backupDir = join(tempPath, extractedDirs[0]);
      
      // Restore database
      const dbDumpPath = join(backupDir, 'database.sql.gz');
      if (existsSync(dbDumpPath)) {
        await this.restoreDatabase(dbDumpPath);
      } else {
        // Restore from JSON exports
        await this.restoreFromJsonExports(backupDir);
      }
      
      // Clean up
      await execAsync(`rm -rf ${tempPath}`);
      
      logger.info('Backup restoration completed', { backupName });
      logger.audit('BACKUP_RESTORED', 'system', 'system', { backupName });
    } catch (error) {
      logger.error('Backup restoration failed', error as Error, { backupName });
      throw error;
    }
  }
  
  private async restoreDatabase(dumpPath: string): Promise<void> {
    const dbUrl = new URL(config.DATABASE_URL);
    const dbConfig = {
      host: dbUrl.hostname,
      port: dbUrl.port || '5432',
      database: dbUrl.pathname.slice(1),
      username: dbUrl.username,
      password: dbUrl.password,
    };
    
    // Decompress and restore
    const restoreCommand = `gunzip -c ${dumpPath} | PGPASSWORD="${dbConfig.password}" psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database}`;
    
    await execAsync(restoreCommand);
  }
  
  private async restoreFromJsonExports(backupDir: string): Promise<void> {
    const files = await readdir(backupDir);
    
    for (const file of files) {
      if (file.endsWith('.json.gz')) {
        const tableName = file.replace('.json.gz', '');
        const filePath = join(backupDir, file);
        
        try {
          // Decompress and read JSON
          const { stdout } = await execAsync(`gunzip -c ${filePath}`);
          const data = JSON.parse(stdout);
          
          if (Array.isArray(data) && data.length > 0) {
            // Clear existing data
            await db.query(`DELETE FROM ${tableName}`);
            
            // Insert restored data
            const columns = Object.keys(data[0]);
            const values = data.map(row => columns.map(col => row[col]));
            
            await db.batchInsert(tableName, columns, values);
            
            logger.info(`Restored table ${tableName}`, { rows: data.length });
          }
        } catch (error) {
          logger.error(`Failed to restore table ${tableName}`, error as Error);
        }
      }
    }
  }
}