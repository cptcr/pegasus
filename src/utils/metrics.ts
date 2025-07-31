import { ExtendedClient } from '../types';
import { config } from '../config';
import { logger } from './logger';
import { db } from '../database/connection';

interface Metrics {
  // System metrics
  cpuUsage: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  
  // Discord metrics
  guilds: number;
  users: number;
  channels: number;
  voiceConnections: number;
  wsLatency: number;
  
  // Bot metrics
  commandsExecuted: number;
  messagesProcessed: number;
  errorsLogged: number;
  
  // Database metrics
  dbPoolStats: {
    total: number;
    idle: number;
    waiting: number;
  };
  queryCount: number;
  slowQueries: number;
}

export class MetricsCollector {
  private metrics: Partial<Metrics> = {};
  private intervals: NodeJS.Timeout[] = [];
  private commandCounter = 0;
  private messageCounter = 0;
  private errorCounter = 0;
  private queryCounter = 0;
  private slowQueryCounter = 0;
  
  constructor(private client: ExtendedClient) {
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // Track command executions
    this.client.on('interactionCreate', (interaction) => {
      if (interaction.isChatInputCommand()) {
        this.commandCounter++;
      }
    });
    
    // Track message processing
    this.client.on('messageCreate', () => {
      this.messageCounter++;
    });
    
    // Track errors
    const originalError = logger.error.bind(logger);
    logger.error = (...args: any[]) => {
      this.errorCounter++;
      return originalError(...args);
    };
    
    // Track database queries
    const originalQuery = db.query.bind(db);
    db.query = async (...args: any[]) => {
      this.queryCounter++;
      const start = Date.now();
      
      try {
        const result = await originalQuery(...args);
        const duration = Date.now() - start;
        
        if (duration > 100) {
          this.slowQueryCounter++;
        }
        
        return result;
      } catch (error) {
        throw error;
      }
    };
  }
  
  async start(): Promise<void> {
    logger.info('Starting metrics collector');
    
    // Collect metrics every minute
    const interval = setInterval(() => {
      this.collectMetrics().catch(error => {
        logger.error('Failed to collect metrics', error);
      });
    }, 60000);
    
    this.intervals.push(interval);
    
    // Initial collection
    await this.collectMetrics();
  }
  
  stop(): void {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    logger.info('Metrics collector stopped');
  }
  
  private async collectMetrics(): Promise<void> {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    this.metrics = {
      // System metrics
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
      
      // Discord metrics
      guilds: this.client.guilds.cache.size,
      users: this.client.users.cache.size,
      channels: this.client.channels.cache.size,
      voiceConnections: this.client.voice?.adapters.size || 0,
      wsLatency: this.client.ws.ping,
      
      // Bot metrics
      commandsExecuted: this.commandCounter,
      messagesProcessed: this.messageCounter,
      errorsLogged: this.errorCounter,
      
      // Database metrics
      dbPoolStats: await db.getPoolStats(),
      queryCount: this.queryCounter,
      slowQueries: this.slowQueryCounter,
    };
    
    // Store metrics in database for historical tracking
    await this.storeMetrics();
    
    // Log summary
    logger.debug('Metrics collected', this.metrics);
  }
  
  private async storeMetrics(): Promise<void> {
    if (!this.metrics.guilds) return;
    
    try {
      await db.query(`
        INSERT INTO bot_metrics (
          timestamp,
          guilds,
          users,
          channels,
          commands_executed,
          messages_processed,
          errors_logged,
          cpu_usage,
          memory_used,
          ws_latency,
          db_pool_total,
          db_pool_idle,
          db_queries,
          slow_queries
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        new Date(),
        this.metrics.guilds,
        this.metrics.users,
        this.metrics.channels,
        this.commandCounter,
        this.messageCounter,
        this.errorCounter,
        this.metrics.cpuUsage,
        this.metrics.memoryUsage?.heapUsed,
        this.metrics.wsLatency,
        this.metrics.dbPoolStats?.total,
        this.metrics.dbPoolStats?.idle,
        this.queryCounter,
        this.slowQueryCounter,
      ]);
      
      // Reset counters after storing
      this.commandCounter = 0;
      this.messageCounter = 0;
      this.errorCounter = 0;
      this.queryCounter = 0;
      this.slowQueryCounter = 0;
    } catch (error) {
      // Create table if it doesn't exist
      if ((error as any).code === '42P01') {
        await this.createMetricsTable();
        await this.storeMetrics();
      } else {
        logger.error('Failed to store metrics', error as Error);
      }
    }
  }
  
  private async createMetricsTable(): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS bot_metrics (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        guilds INTEGER,
        users INTEGER,
        channels INTEGER,
        commands_executed INTEGER,
        messages_processed INTEGER,
        errors_logged INTEGER,
        cpu_usage FLOAT,
        memory_used INTEGER,
        ws_latency INTEGER,
        db_pool_total INTEGER,
        db_pool_idle INTEGER,
        db_queries INTEGER,
        slow_queries INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_bot_metrics_timestamp ON bot_metrics(timestamp DESC);
    `);
  }
  
  async getMetrics(): Promise<Metrics> {
    await this.collectMetrics();
    return this.metrics as Metrics;
  }
  
  async getHistoricalMetrics(hours: number = 24): Promise<any[]> {
    const result = await db.query(`
      SELECT 
        timestamp,
        guilds,
        users,
        channels,
        commands_executed,
        messages_processed,
        errors_logged,
        cpu_usage,
        memory_used,
        ws_latency
      FROM bot_metrics
      WHERE timestamp > NOW() - INTERVAL '${hours} hours'
      ORDER BY timestamp DESC
    `);
    
    return result.rows;
  }
  
  async getMetricsSummary(): Promise<any> {
    const current = await this.getMetrics();
    
    // Get 24-hour averages
    const avgResult = await db.query(`
      SELECT 
        AVG(guilds) as avg_guilds,
        AVG(users) as avg_users,
        AVG(commands_executed) as avg_commands,
        AVG(cpu_usage) as avg_cpu,
        AVG(memory_used) as avg_memory,
        AVG(ws_latency) as avg_latency
      FROM bot_metrics
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `);
    
    const averages = avgResult.rows[0];
    
    return {
      current,
      averages: {
        guilds: Math.round(averages.avg_guilds || 0),
        users: Math.round(averages.avg_users || 0),
        commandsPerHour: Math.round((averages.avg_commands || 0) * 24),
        cpuUsage: Math.round(averages.avg_cpu || 0),
        memoryUsed: Math.round(averages.avg_memory || 0),
        wsLatency: Math.round(averages.avg_latency || 0),
      },
      trends: await this.calculateTrends(),
    };
  }
  
  private async calculateTrends(): Promise<any> {
    // Compare current hour to previous hour
    const result = await db.query(`
      WITH current_hour AS (
        SELECT 
          AVG(guilds) as guilds,
          AVG(commands_executed) as commands
        FROM bot_metrics
        WHERE timestamp > NOW() - INTERVAL '1 hour'
      ),
      previous_hour AS (
        SELECT 
          AVG(guilds) as guilds,
          AVG(commands_executed) as commands
        FROM bot_metrics
        WHERE timestamp > NOW() - INTERVAL '2 hours'
          AND timestamp <= NOW() - INTERVAL '1 hour'
      )
      SELECT 
        COALESCE(((c.guilds - p.guilds) / NULLIF(p.guilds, 0)) * 100, 0) as guild_growth,
        COALESCE(((c.commands - p.commands) / NULLIF(p.commands, 0)) * 100, 0) as command_growth
      FROM current_hour c, previous_hour p
    `);
    
    const trends = result.rows[0] || { guild_growth: 0, command_growth: 0 };
    
    return {
      guildGrowth: Math.round(trends.guild_growth),
      commandGrowth: Math.round(trends.command_growth),
    };
  }
}