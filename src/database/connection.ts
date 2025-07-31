import { Pool, Client, PoolConfig, QueryResult } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { MigrationRunner } from './migrations';

export interface QueryOptions {
  timeout?: number;
  throwOnError?: boolean;
}

export class Database {
  private pool: Pool;
  private static instance: Database;
  private migrationRunner: MigrationRunner;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  
  private constructor() {
    const poolConfig: PoolConfig = {
      ...config.getDatabaseConfig(),
      // Event handlers
      log: (msg: string) => logger.debug('PostgreSQL', { message: msg }),
      error: (err: Error) => logger.error('PostgreSQL pool error', err),
    };
    
    this.pool = new Pool(poolConfig);
    this.migrationRunner = new MigrationRunner(this.pool);
    
    // Set up event handlers
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.pool.on('error', async (err) => {
      logger.error('Unexpected database connection error', err);
      await this.handleConnectionError();
    });
    
    this.pool.on('connect', (client) => {
      logger.debug('New database connection established');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    });
    
    this.pool.on('acquire', (client) => {
      logger.trace('Database connection acquired from pool');
    });
    
    this.pool.on('remove', (client) => {
      logger.trace('Database connection removed from pool');
    });
  }
  
  private async handleConnectionError(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, exiting...');
      process.exit(1);
    }
    
    this.reconnectAttempts++;
    logger.info(`Attempting to reconnect to database (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
    
    try {
      await this.pool.query('SELECT 1');
      logger.info('Successfully reconnected to database');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    } catch (error) {
      logger.error('Reconnection attempt failed', error as Error);
      await this.handleConnectionError();
    }
  }
  
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }
  
  public async query<T = any>(
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const client = await this.pool.connect();
    
    try {
      // Set query timeout if specified
      if (options.timeout) {
        await client.query(`SET statement_timeout = ${options.timeout}`);
      }
      
      const result = await client.query<T>(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 100) {
        logger.performance('Slow query detected', duration, {
          query: text.slice(0, 100),
          params: params?.length,
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query failed', error as Error, {
        query: text.slice(0, 100),
        params: params?.length,
        duration,
      });
      
      if (options.throwOnError !== false) {
        throw error;
      }
      
      // Return empty result if not throwing
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    } finally {
      if (options.timeout) {
        await client.query('RESET statement_timeout');
      }
      client.release();
    }
  }
  
  public async transaction<T>(
    callback: (client: Client) => Promise<T>,
    isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE'
  ): Promise<T> {
    const client = await this.pool.connect();
    const start = Date.now();
    
    try {
      await client.query('BEGIN');
      
      if (isolationLevel) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      }
      
      const result = await callback(client);
      await client.query('COMMIT');
      
      const duration = Date.now() - start;
      logger.performance('Transaction completed', duration);
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      const duration = Date.now() - start;
      
      logger.error('Transaction failed', error as Error, { duration });
      throw error;
    } finally {
      client.release();
    }
  }
  
  public async batchInsert<T = any>(
    table: string,
    columns: string[],
    values: any[][],
    onConflict?: string
  ): Promise<QueryResult<T>> {
    if (values.length === 0) {
      return { rows: [], rowCount: 0, command: 'INSERT', oid: 0, fields: [] };
    }
    
    const placeholders = values.map((_, rowIndex) =>
      `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
    ).join(', ');
    
    const flatValues = values.flat();
    const conflictClause = onConflict ? ` ON CONFLICT ${onConflict}` : '';
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${placeholders}
      ${conflictClause}
      RETURNING *
    `;
    
    return this.query<T>(query, flatValues);
  }
  
  public async upsert<T = any>(
    table: string,
    data: Record<string, any>,
    conflictColumns: string[],
    updateColumns?: string[]
  ): Promise<QueryResult<T>> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const updateCols = updateColumns || columns.filter(col => !conflictColumns.includes(col));
    
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const conflictClause = `(${conflictColumns.join(', ')})`;
    const updateClause = updateCols.map(col => `${col} = EXCLUDED.${col}`).join(', ');
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT ${conflictClause}
      DO UPDATE SET ${updateClause}
      RETURNING *
    `;
    
    return this.query<T>(query, values);
  }
  
  public async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1', [], { timeout: 5000 });
      return true;
    } catch (error) {
      logger.error('Health check failed', error as Error);
      return false;
    }
  }
  
  public async getPoolStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
  
  public async close(): Promise<void> {
    logger.info('Closing database connection pool');
    await this.pool.end();
  }
  
  public async init(): Promise<void> {
    try {
      // Test connection
      await this.query('SELECT 1');
      logger.info('Database connection established');
      
      // Run migrations
      await this.migrationRunner.initialize();
      await this.migrationRunner.migrate();
      
      // Create initial tables if migrations are not set up
      await this.createTables();
      
      logger.info('Database initialization complete');
    } catch (error) {
      logger.error('Database initialization failed', error as Error);
      throw error;
    }
  }
  
  private async createTables(): Promise<void> {
    // This is kept for backward compatibility
    // New tables should be added via migrations
    const queries = [
      // Add any legacy table creation queries here if needed
    ];
    
    for (const query of queries) {
      try {
        await this.query(query);
      } catch (error) {
        // Ignore errors for existing tables
        logger.debug('Table creation query failed (likely already exists)', { error });
      }
    }
  }
  
  // Utility methods for common operations
  public async exists(table: string, conditions: Record<string, any>): Promise<boolean> {
    const whereClause = Object.keys(conditions)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(' AND ');
    
    const result = await this.query(
      `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${whereClause})`,
      Object.values(conditions)
    );
    
    return result.rows[0].exists;
  }
  
  public async count(table: string, conditions?: Record<string, any>): Promise<number> {
    let query = `SELECT COUNT(*) FROM ${table}`;
    let params: any[] = [];
    
    if (conditions && Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key, i) => `${key} = $${i + 1}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      params = Object.values(conditions);
    }
    
    const result = await this.query(query, params);
    return parseInt(result.rows[0].count);
  }
}

// Export singleton instance
export const db = Database.getInstance();