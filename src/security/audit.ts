import { database } from '../database/connection';
import { logger } from '../utils/logger';
import { EmbedBuilder, WebhookClient } from 'discord.js';
import { config } from '../config';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  guildId: string;
  action: string;
  category: string;
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

export class AuditLogger {
  private webhookClient?: WebhookClient;

  constructor() {
    // Initialize webhook if configured
    const webhookUrl = process.env.AUDIT_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        this.webhookClient = new WebhookClient({ url: webhookUrl });
      } catch (error) {
        logger.error('Failed to initialize audit webhook', error as Error);
      }
    }
  }

  /**
   * Log an audit entry
   */
  async log(
    userId: string,
    guildId: string,
    action: string,
    category: string,
    details: Record<string, any> = {},
    metadata?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    try {
      // Store in database
      const result = await database.query<{ id: string }>(
        `INSERT INTO audit_logs (user_id, guild_id, action, category, details, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          userId,
          guildId,
          action,
          category,
          JSON.stringify(details),
          metadata?.ip || null,
          metadata?.userAgent || null
        ]
      );

      // Send to webhook if configured
      if (this.webhookClient) {
        await this.sendWebhookNotification({
          id: result.rows[0].id,
          timestamp: new Date(),
          userId,
          guildId,
          action,
          category,
          details,
          ip: metadata?.ip,
          userAgent: metadata?.userAgent
        });
      }

      // Log to file system
      logger.audit(action, userId, guildId, { category, ...details });
    } catch (error) {
      logger.error('Failed to log audit entry', error as Error, {
        userId,
        guildId,
        action,
        category
      });
    }
  }

  /**
   * Send audit notification to webhook
   */
  private async sendWebhookNotification(entry: AuditEntry): Promise<void> {
    if (!this.webhookClient) return;

    const embed = new EmbedBuilder()
      .setTitle('Audit Log Entry')
      .setColor(this.getCategoryColor(entry.category))
      .addFields(
        { name: 'Action', value: entry.action, inline: true },
        { name: 'Category', value: entry.category, inline: true },
        { name: 'User ID', value: entry.userId, inline: true },
        { name: 'Guild ID', value: entry.guildId, inline: true },
        { name: 'Timestamp', value: entry.timestamp.toISOString(), inline: true }
      )
      .setFooter({ text: `ID: ${entry.id}` })
      .setTimestamp();

    // Add details if present
    if (Object.keys(entry.details).length > 0) {
      const detailsText = Object.entries(entry.details)
        .map(([key, value]) => `**${key}:** ${JSON.stringify(value)}`)
        .join('\n')
        .slice(0, 1024);
      
      embed.addFields({ name: 'Details', value: detailsText });
    }

    // Add metadata if present
    if (entry.ip || entry.userAgent) {
      const metadata = [];
      if (entry.ip) metadata.push(`**IP:** ${entry.ip}`);
      if (entry.userAgent) metadata.push(`**User Agent:** ${entry.userAgent.slice(0, 100)}`);
      
      embed.addFields({ name: 'Metadata', value: metadata.join('\n') });
    }

    try {
      await this.webhookClient.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send audit webhook', error as Error);
    }
  }

  /**
   * Get color based on category
   */
  private getCategoryColor(category: string): number {
    const colors: Record<string, number> = {
      'moderation': 0xff0000,    // Red
      'configuration': 0x0099ff, // Blue
      'economy': 0x00ff00,      // Green
      'permissions': 0xff9900,   // Orange
      'security': 0x9900ff,     // Purple
      'critical': 0xff0066,     // Pink
    };

    return colors[category] || 0x808080; // Gray default
  }

  /**
   * Query audit logs
   */
  async query(
    filters: {
      guildId?: string;
      userId?: string;
      category?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    },
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditEntry[]> {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.guildId) {
      query += ` AND guild_id = $${paramIndex++}`;
      params.push(filters.guildId);
    }

    if (filters.userId) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(filters.userId);
    }

    if (filters.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters.action) {
      query += ` AND action = $${paramIndex++}`;
      params.push(filters.action);
    }

    if (filters.startDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await database.query<{
      id: string;
      user_id: string;
      guild_id: string;
      action: string;
      category: string;
      details: any;
      ip: string | null;
      user_agent: string | null;
      created_at: Date;
    }>(query, params);

    return result.rows.map(row => ({
      id: row.id,
      timestamp: row.created_at,
      userId: row.user_id,
      guildId: row.guild_id,
      action: row.action,
      category: row.category,
      details: row.details,
      ip: row.ip || undefined,
      userAgent: row.user_agent || undefined
    }));
  }

  /**
   * Get audit statistics
   */
  async getStatistics(guildId: string, days: number = 30): Promise<{
    totalActions: number;
    actionsByCategory: Record<string, number>;
    actionsByUser: Array<{ userId: string; count: number }>;
    recentActions: AuditEntry[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total actions
    const totalResult = await database.query<{ count: string }>(
      'SELECT COUNT(*) FROM audit_logs WHERE guild_id = $1 AND created_at >= $2',
      [guildId, startDate]
    );

    // Actions by category
    const categoryResult = await database.query<{ category: string; count: string }>(
      `SELECT category, COUNT(*) as count 
       FROM audit_logs 
       WHERE guild_id = $1 AND created_at >= $2 
       GROUP BY category`,
      [guildId, startDate]
    );

    // Top users
    const userResult = await database.query<{ user_id: string; count: string }>(
      `SELECT user_id, COUNT(*) as count 
       FROM audit_logs 
       WHERE guild_id = $1 AND created_at >= $2 
       GROUP BY user_id 
       ORDER BY count DESC 
       LIMIT 10`,
      [guildId, startDate]
    );

    // Recent actions
    const recentActions = await this.query({ guildId }, 10);

    return {
      totalActions: parseInt(totalResult.rows[0].count),
      actionsByCategory: Object.fromEntries(
        categoryResult.rows.map(row => [row.category, parseInt(row.count)])
      ),
      actionsByUser: userResult.rows.map(row => ({
        userId: row.user_id,
        count: parseInt(row.count)
      })),
      recentActions
    };
  }

  /**
   * Clean up old audit logs
   */
  async cleanup(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await database.query(
      'DELETE FROM audit_logs WHERE created_at < $1',
      [cutoffDate]
    );

    const deleted = result.rowCount || 0;
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old audit log entries`);
    }

    return deleted;
  }
}

// Audit log categories
export const AuditCategories = {
  MODERATION: 'moderation',
  CONFIGURATION: 'configuration',
  ECONOMY: 'economy',
  PERMISSIONS: 'permissions',
  SECURITY: 'security',
  CRITICAL: 'critical',
  USER_ACTION: 'user_action',
  SYSTEM: 'system'
} as const;

// Audit log actions
export const AuditActions = {
  // Moderation
  BAN_USER: 'ban_user',
  UNBAN_USER: 'unban_user',
  KICK_USER: 'kick_user',
  MUTE_USER: 'mute_user',
  UNMUTE_USER: 'unmute_user',
  WARN_USER: 'warn_user',
  CLEAR_MESSAGES: 'clear_messages',
  
  // Configuration
  UPDATE_SETTINGS: 'update_settings',
  UPDATE_ROLE: 'update_role',
  UPDATE_CHANNEL: 'update_channel',
  
  // Economy
  TRANSFER_MONEY: 'transfer_money',
  PURCHASE_ITEM: 'purchase_item',
  CLAIM_REWARD: 'claim_reward',
  
  // Permissions
  GRANT_PERMISSION: 'grant_permission',
  REVOKE_PERMISSION: 'revoke_permission',
  
  // Security
  FAILED_AUTH: 'failed_auth',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  
  // Critical
  DATABASE_MODIFIED: 'database_modified',
  BOT_CONFIG_CHANGED: 'bot_config_changed',
  EMERGENCY_SHUTDOWN: 'emergency_shutdown'
} as const;

// Global audit logger instance
export const auditLogger = new AuditLogger();