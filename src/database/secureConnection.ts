import { Pool, Client, PoolConfig, QueryResult } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { InputValidator } from '../security/validator';
import { auditLogger, AuditCategories } from '../security/audit';

// Whitelist of allowed tables to prevent SQL injection
const ALLOWED_TABLES = new Set([
  // Core tables
  'guilds',
  'users',
  'guild_members',
  'guild_settings',
  
  // Economy tables
  'economy_users',
  'economy_transactions',
  'shop_items',
  'user_inventory',
  
  // XP System tables
  'user_xp',
  'xp_logs',
  'xp_channel_multipliers',
  'xp_role_multipliers',
  'xp_user_multipliers',
  'xp_event_multipliers',
  'xp_role_rewards',
  'xp_daily_stats',
  'xp_statistics',
  'xp_anti_abuse_logs',
  
  // Giveaway tables
  'giveaways',
  'giveaway_entries',
  'giveaway_winners',
  
  // Moderation tables
  'moderation_cases',
  'warnings',
  'auto_mod_rules',
  'auto_mod_actions',
  
  // Ticket tables
  'ticket_panels',
  'tickets',
  'ticket_messages',
  'ticket_participants',
  
  // Security tables
  'audit_logs',
  'user_permissions',
  'role_permissions',
  'security_tokens',
  'blocked_users',
  'rate_limit_overrides',
  'ip_bans',
  'security_alerts',
  
  // Other tables
  'reminders',
  'reaction_roles',
  'custom_commands',
  'welcome_settings',
  'logging_settings',
  'starboard_settings',
  'temporary_channels',
  'voice_stats'
]);

// Whitelist of allowed column names (common ones, extend as needed)
const ALLOWED_COLUMNS = new Set([
  // IDs
  'id', 'user_id', 'guild_id', 'channel_id', 'message_id', 'role_id',
  
  // Common fields
  'name', 'description', 'enabled', 'active', 'type', 'value', 'data',
  'created_at', 'updated_at', 'deleted_at', 'expires_at',
  
  // User fields
  'username', 'discriminator', 'avatar', 'bot', 'system',
  
  // Economy fields
  'coins', 'bank', 'bank_limit', 'daily_streak', 'work_streak',
  'last_daily', 'last_weekly', 'last_work', 'total_earned', 'total_spent',
  'multiplier', 'prestige', 'inventory',
  
  // XP fields
  'xp', 'level', 'message_count', 'voice_minutes', 'streak_days',
  'last_message_time', 'last_streak_update',
  
  // Moderation fields
  'reason', 'moderator_id', 'action', 'duration', 'case_id',
  
  // Configuration fields
  'prefix', 'language', 'timezone', 'premium', 'settings', 'config',
  'requirements', 'permissions', 'whitelist', 'blacklist'
]);

export interface SecureQueryOptions {
  timeout?: number;
  userId?: string; // For audit logging
  action?: string; // For audit logging
  throwOnError?: boolean;
}

export class SecureDatabase {
  private pool: Pool;
  private static instance: SecureDatabase;
  
  private constructor() {
    const poolConfig: PoolConfig = {
      ...config.getDatabaseConfig(),
      statement_timeout: 30000, // 30 second default timeout
      query_timeout: 30000,
      connectionTimeoutMillis: 5000,
    };
    
    this.pool = new Pool(poolConfig);
  }
  
  public static getInstance(): SecureDatabase {
    if (!SecureDatabase.instance) {
      SecureDatabase.instance = new SecureDatabase();
    }
    return SecureDatabase.instance;
  }
  
  /**
   * Escape and validate table name
   */
  private escapeIdentifier(identifier: string, allowedSet: Set<string>, type: string): string {
    // Check if identifier is in whitelist
    if (!allowedSet.has(identifier)) {
      throw new Error(`Invalid ${type}: ${identifier}`);
    }
    
    // Additional validation
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid ${type} format: ${identifier}`);
    }
    
    // Escape for PostgreSQL
    return `"${identifier}"`;
  }
  
  /**
   * Validate and escape table name
   */
  private escapeTable(table: string): string {
    return this.escapeIdentifier(table, ALLOWED_TABLES, 'table');
  }
  
  /**
   * Validate and escape column name
   */
  private escapeColumn(column: string): string {
    // Allow dynamic columns with prefix validation
    const prefixes = ['metadata_', 'custom_', 'setting_', 'stat_'];
    const isAllowed = ALLOWED_COLUMNS.has(column) || 
                     prefixes.some(prefix => column.startsWith(prefix));
    
    if (!isAllowed) {
      throw new Error(`Invalid column: ${column}`);
    }
    
    return this.escapeIdentifier(column, new Set([column]), 'column');
  }
  
  /**
   * Execute a secure parameterized query
   */
  public async query<T = any>(
    text: string,
    params?: any[],
    options: SecureQueryOptions = {}
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const client = await this.pool.connect();
    
    try {
      // Set query timeout if specified
      if (options.timeout) {
        await client.query(`SET statement_timeout = ${options.timeout}`);
      }
      
      // Validate query doesn't contain obvious injection attempts
      if (InputValidator.containsSQLInjection(text)) {
        throw new Error('Potential SQL injection detected');
      }
      
      const result = await client.query<T>(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 1000) {
        logger.performance('Slow query detected', duration, {
          query: text.slice(0, 100),
          params: params?.length,
        });
      }
      
      // Audit log for sensitive operations
      if (options.userId && options.action) {
        const isSensitive = ['UPDATE', 'DELETE', 'INSERT'].some(op => 
          text.toUpperCase().includes(op)
        );
        
        if (isSensitive) {
          await auditLogger.log(
            options.userId,
            'system',
            options.action,
            AuditCategories.DATABASE,
            {
              query_type: text.split(' ')[0].toUpperCase(),
              duration,
              affected_rows: result.rowCount
            }
          );
        }
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Secure query failed', error as Error, {
        query: text.slice(0, 100),
        duration,
      });
      
      if (options.throwOnError !== false) {
        throw error;
      }
      
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    } finally {
      if (options.timeout) {
        await client.query('RESET statement_timeout');
      }
      client.release();
    }
  }
  
  /**
   * Secure SELECT query builder
   */
  public async select<T = any>(
    table: string,
    conditions: Record<string, any> = {},
    options: {
      columns?: string[];
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<T[]> {
    const escapedTable = this.escapeTable(table);
    
    let query = 'SELECT ';
    
    // Handle columns
    if (options.columns && options.columns.length > 0) {
      query += options.columns.map(col => this.escapeColumn(col)).join(', ');
    } else {
      query += '*';
    }
    
    query += ` FROM ${escapedTable}`;
    
    // Build WHERE clause
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(conditions)) {
      const column = this.escapeColumn(key);
      if (value === null) {
        whereConditions.push(`${column} IS NULL`);
      } else if (Array.isArray(value)) {
        whereConditions.push(`${column} = ANY($${paramIndex})`);
        params.push(value);
        paramIndex++;
      } else {
        whereConditions.push(`${column} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Handle ORDER BY
    if (options.orderBy) {
      const orderColumn = this.escapeColumn(options.orderBy);
      const direction = options.orderDirection || 'ASC';
      query += ` ORDER BY ${orderColumn} ${direction}`;
    }
    
    // Handle LIMIT and OFFSET
    if (options.limit) {
      query += ` LIMIT ${parseInt(options.limit.toString())}`;
    }
    
    if (options.offset) {
      query += ` OFFSET ${parseInt(options.offset.toString())}`;
    }
    
    const result = await this.query<T>(query, params);
    return result.rows;
  }
  
  /**
   * Secure INSERT query builder
   */
  public async insert<T = any>(
    table: string,
    data: Record<string, any>,
    options: {
      returning?: string[];
      onConflict?: {
        columns: string[];
        action: 'DO NOTHING' | 'DO UPDATE';
        updateColumns?: string[];
      };
    } = {}
  ): Promise<T | null> {
    const escapedTable = this.escapeTable(table);
    const columns: string[] = [];
    const values: any[] = [];
    const placeholders: string[] = [];
    
    let paramIndex = 1;
    for (const [key, value] of Object.entries(data)) {
      columns.push(this.escapeColumn(key));
      values.push(value);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    let query = `INSERT INTO ${escapedTable} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
    
    // Handle ON CONFLICT
    if (options.onConflict) {
      const conflictColumns = options.onConflict.columns.map(col => this.escapeColumn(col));
      query += ` ON CONFLICT (${conflictColumns.join(', ')})`;
      
      if (options.onConflict.action === 'DO NOTHING') {
        query += ' DO NOTHING';
      } else if (options.onConflict.action === 'DO UPDATE') {
        const updateColumns = options.onConflict.updateColumns || Object.keys(data);
        const updates = updateColumns
          .filter(col => !options.onConflict!.columns.includes(col))
          .map(col => {
            const escaped = this.escapeColumn(col);
            return `${escaped} = EXCLUDED.${escaped}`;
          });
        
        if (updates.length > 0) {
          query += ` DO UPDATE SET ${updates.join(', ')}`;
        } else {
          query += ' DO NOTHING';
        }
      }
    }
    
    // Handle RETURNING
    if (options.returning) {
      const returningColumns = options.returning.map(col => this.escapeColumn(col));
      query += ` RETURNING ${returningColumns.join(', ')}`;
    } else if (!options.onConflict || options.onConflict.action !== 'DO NOTHING') {
      query += ' RETURNING *';
    }
    
    const result = await this.query<T>(query, values);
    return result.rows[0] || null;
  }
  
  /**
   * Secure UPDATE query builder
   */
  public async update<T = any>(
    table: string,
    data: Record<string, any>,
    conditions: Record<string, any>,
    options: {
      returning?: string[];
    } = {}
  ): Promise<T[]> {
    if (Object.keys(conditions).length === 0) {
      throw new Error('UPDATE without conditions is not allowed');
    }
    
    const escapedTable = this.escapeTable(table);
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Build SET clause
    for (const [key, value] of Object.entries(data)) {
      const column = this.escapeColumn(key);
      updates.push(`${column} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
    
    let query = `UPDATE ${escapedTable} SET ${updates.join(', ')}`;
    
    // Build WHERE clause
    const whereConditions: string[] = [];
    for (const [key, value] of Object.entries(conditions)) {
      const column = this.escapeColumn(key);
      if (value === null) {
        whereConditions.push(`${column} IS NULL`);
      } else {
        whereConditions.push(`${column} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }
    
    query += ' WHERE ' + whereConditions.join(' AND ');
    
    // Handle RETURNING
    if (options.returning) {
      const returningColumns = options.returning.map(col => this.escapeColumn(col));
      query += ` RETURNING ${returningColumns.join(', ')}`;
    } else {
      query += ' RETURNING *';
    }
    
    const result = await this.query<T>(query, params);
    return result.rows;
  }
  
  /**
   * Secure DELETE query builder
   */
  public async delete<T = any>(
    table: string,
    conditions: Record<string, any>,
    options: {
      returning?: string[];
    } = {}
  ): Promise<T[]> {
    if (Object.keys(conditions).length === 0) {
      throw new Error('DELETE without conditions is not allowed');
    }
    
    const escapedTable = this.escapeTable(table);
    let query = `DELETE FROM ${escapedTable}`;
    
    // Build WHERE clause
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(conditions)) {
      const column = this.escapeColumn(key);
      if (value === null) {
        whereConditions.push(`${column} IS NULL`);
      } else {
        whereConditions.push(`${column} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }
    
    query += ' WHERE ' + whereConditions.join(' AND ');
    
    // Handle RETURNING
    if (options.returning) {
      const returningColumns = options.returning.map(col => this.escapeColumn(col));
      query += ` RETURNING ${returningColumns.join(', ')}`;
    }
    
    const result = await this.query<T>(query, params);
    return result.rows;
  }
  
  /**
   * Secure transaction wrapper
   */
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
  
  /**
   * Secure count query
   */
  public async count(
    table: string,
    conditions: Record<string, any> = {}
  ): Promise<number> {
    const result = await this.select<{ count: string }>(
      table,
      conditions,
      { columns: ['COUNT(*) as count'] }
    );
    
    return parseInt(result[0]?.count || '0');
  }
  
  /**
   * Check if record exists
   */
  public async exists(
    table: string,
    conditions: Record<string, any>
  ): Promise<boolean> {
    const count = await this.count(table, conditions);
    return count > 0;
  }
  
  /**
   * Get pool statistics
   */
  public getPoolStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
  
  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1', [], { timeout: 5000 });
      return true;
    } catch (error) {
      logger.error('Database health check failed', error as Error);
      return false;
    }
  }
  
  /**
   * Close database connections
   */
  public async close(): Promise<void> {
    logger.info('Closing secure database connection pool');
    await this.pool.end();
  }
}

// Export singleton instance
export const secureDb = SecureDatabase.getInstance();