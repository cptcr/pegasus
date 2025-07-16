import { Client, User, TextChannel, EmbedBuilder } from 'discord.js';
import { db } from '../database/connection';
import { security, validateUserInput } from './security';
import { i18n } from '../i18n';
import ms from 'ms';

interface Reminder {
  id: string;
  userId: string;
  guildId?: string;
  channelId?: string;
  message: string;
  remindAt: Date;
  repeating: boolean;
  interval?: number;
  maxRepeats?: number;
  currentRepeats: number;
  createdAt: Date;
  active: boolean;
}

interface ReminderCreate {
  userId: string;
  guildId?: string;
  channelId?: string;
  message: string;
  duration: string;
  repeating?: boolean;
  interval?: string;
  maxRepeats?: number;
}

export class ReminderHandler {
  private static instance: ReminderHandler;
  private client: Client | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly maxRemindersPerUser = 10;
  private readonly maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year
  private readonly minDuration = 60 * 1000; // 1 minute

  public static getInstance(): ReminderHandler {
    if (!ReminderHandler.instance) {
      ReminderHandler.instance = new ReminderHandler();
    }
    return ReminderHandler.instance;
  }

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS reminders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(20) NOT NULL,
          guild_id VARCHAR(20),
          channel_id VARCHAR(20),
          message TEXT NOT NULL,
          remind_at TIMESTAMP NOT NULL,
          repeating BOOLEAN DEFAULT false,
          interval_ms INTEGER,
          max_repeats INTEGER,
          current_repeats INTEGER DEFAULT 0,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_reminders_remind_at 
        ON reminders(remind_at) WHERE active = true
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_reminders_user 
        ON reminders(user_id) WHERE active = true
      `);

      console.log('Reminders database initialized');
    } catch (error) {
      console.error('Failed to initialize reminders database:', error);
    }
  }

  public setClient(client: Client): void {
    this.client = client;
    this.startReminderChecker();
  }

  private startReminderChecker(): void {
    // Check for due reminders every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkDueReminders();
    }, 30000);

    console.log('Reminder checker started');
  }

  public async createReminder(data: ReminderCreate): Promise<{ success: boolean; message: string; reminderId?: string }> {
    const input = validateUserInput({
      userId: data.userId,
      guildId: data.guildId,
      channelId: data.channelId,
      text: data.message
    });

    if (!input || !input.userId) {
      return { success: false, message: 'Invalid user input' };
    }

    // Check user's current reminder count
    const userRemindersCount = await this.getUserReminderCount(input.userId);
    if (userRemindersCount >= this.maxRemindersPerUser) {
      return { 
        success: false, 
        message: i18n.t('reminders.limit_reached', { variables: { limit: this.maxRemindersPerUser } })
      };
    }

    // Parse duration
    const durationMs = ms(data.duration);
    if (!durationMs || durationMs < this.minDuration || durationMs > this.maxDuration) {
      return { 
        success: false, 
        message: i18n.t('reminders.invalid_time')
      };
    }

    const remindAt = new Date(Date.now() + durationMs);
    let intervalMs: number | null = null;

    // Parse interval if repeating
    if (data.repeating && data.interval) {
      intervalMs = ms(data.interval);
      if (!intervalMs || intervalMs < this.minDuration) {
        return { 
          success: false, 
          message: 'Invalid repeat interval. Minimum is 1 minute.'
        };
      }
    }

    try {
      const result = await db.query(`
        INSERT INTO reminders (
          user_id, guild_id, channel_id, message, remind_at, 
          repeating, interval_ms, max_repeats
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        input.userId,
        input.guildId || null,
        input.channelId || null,
        input.text || data.message,
        remindAt,
        data.repeating || false,
        intervalMs,
        data.maxRepeats || null
      ]);

      const reminderId = result.rows[0].id;
      
      return {
        success: true,
        message: i18n.t('reminders.set', { 
          variables: { time: this.formatDuration(durationMs) }
        }),
        reminderId
      };
    } catch (error) {
      console.error('Error creating reminder:', error);
      return { success: false, message: 'Failed to create reminder' };
    }
  }

  public async getUserReminders(userId: string, guildId?: string): Promise<Reminder[]> {
    const input = validateUserInput({ userId, guildId });
    if (!input || !input.userId) {
      return [];
    }

    try {
      const query = guildId 
        ? 'SELECT * FROM reminders WHERE user_id = $1 AND guild_id = $2 AND active = true ORDER BY remind_at ASC'
        : 'SELECT * FROM reminders WHERE user_id = $1 AND active = true ORDER BY remind_at ASC';
      
      const params = guildId ? [input.userId, input.guildId] : [input.userId];
      const result = await db.query(query, params);

      return result.rows.map(this.mapDatabaseRowToReminder);
    } catch (error) {
      console.error('Error getting user reminders:', error);
      return [];
    }
  }

  public async cancelReminder(reminderId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const input = validateUserInput({ userId });
    if (!input || !input.userId) {
      return { success: false, message: 'Invalid user input' };
    }

    try {
      const result = await db.query(`
        UPDATE reminders 
        SET active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2 AND active = true
      `, [reminderId, input.userId]);

      if (result.rowCount === 0) {
        return { 
          success: false, 
          message: i18n.t('reminders.not_found')
        };
      }

      return {
        success: true,
        message: i18n.t('reminders.cancelled')
      };
    } catch (error) {
      console.error('Error cancelling reminder:', error);
      return { success: false, message: 'Failed to cancel reminder' };
    }
  }

  private async getUserReminderCount(userId: string): Promise<number> {
    try {
      const result = await db.query(
        'SELECT COUNT(*) FROM reminders WHERE user_id = $1 AND active = true',
        [userId]
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting user reminder count:', error);
      return 0;
    }
  }

  private async checkDueReminders(): Promise<void> {
    if (!this.client) return;

    try {
      const result = await db.query(`
        SELECT * FROM reminders 
        WHERE remind_at <= CURRENT_TIMESTAMP AND active = true
        ORDER BY remind_at ASC
        LIMIT 50
      `);

      for (const row of result.rows) {
        const reminder = this.mapDatabaseRowToReminder(row);
        await this.sendReminder(reminder);
        await this.handleReminderAfterSend(reminder);
      }
    } catch (error) {
      console.error('Error checking due reminders:', error);
    }
  }

  private async sendReminder(reminder: Reminder): Promise<void> {
    if (!this.client) return;

    try {
      const user = await this.client.users.fetch(reminder.userId);
      if (!user) return;

      const t = i18n.createTranslator(reminder.userId, reminder.guildId);
      const timeSinceCreated = Date.now() - reminder.createdAt.getTime();

      const embed = new EmbedBuilder()
        .setTitle('⏰ Reminder')
        .setDescription(reminder.message)
        .setColor(0x0099ff)
        .setFooter({ 
          text: t('reminders.reminder_dm', {
            variables: {
              message: reminder.message,
              time: this.formatDuration(timeSinceCreated)
            }
          })
        })
        .setTimestamp();

      // Try to send to channel first if specified
      if (reminder.channelId && reminder.guildId) {
        try {
          const guild = await this.client.guilds.fetch(reminder.guildId);
          const channel = await guild.channels.fetch(reminder.channelId) as TextChannel;
          
          if (channel && channel.isTextBased()) {
            await channel.send({
              content: `<@${reminder.userId}>`,
              embeds: [embed]
            });
            return;
          }
        } catch (error) {
          // Fall back to DM if channel sending fails
          console.warn('Failed to send reminder to channel, falling back to DM:', error);
        }
      }

      // Send as DM
      await user.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending reminder:', error);
      // Mark reminder as inactive if we can't send it
      await this.deactivateReminder(reminder.id);
    }
  }

  private async handleReminderAfterSend(reminder: Reminder): Promise<void> {
    try {
      if (reminder.repeating && reminder.interval && 
          (!reminder.maxRepeats || reminder.currentRepeats < reminder.maxRepeats)) {
        
        // Schedule next repeat
        const nextRemindAt = new Date(Date.now() + reminder.interval);
        const newRepeats = reminder.currentRepeats + 1;

        await db.query(`
          UPDATE reminders 
          SET remind_at = $1, current_repeats = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [nextRemindAt, newRepeats, reminder.id]);
      } else {
        // Deactivate one-time reminder or completed repeating reminder
        await this.deactivateReminder(reminder.id);
      }
    } catch (error) {
      console.error('Error handling reminder after send:', error);
    }
  }

  private async deactivateReminder(reminderId: string): Promise<void> {
    try {
      await db.query(`
        UPDATE reminders 
        SET active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [reminderId]);
    } catch (error) {
      console.error('Error deactivating reminder:', error);
    }
  }

  private mapDatabaseRowToReminder(row: any): Reminder {
    return {
      id: row.id,
      userId: row.user_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      message: row.message,
      remindAt: new Date(row.remind_at),
      repeating: row.repeating,
      interval: row.interval_ms,
      maxRepeats: row.max_repeats,
      currentRepeats: row.current_repeats,
      createdAt: new Date(row.created_at),
      active: row.active
    };
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      return `${seconds} second${seconds > 1 ? 's' : ''}`;
    }
  }

  public async cleanupExpiredReminders(): Promise<number> {
    try {
      const result = await db.query(`
        DELETE FROM reminders 
        WHERE active = false 
        AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
      `);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning up expired reminders:', error);
      return 0;
    }
  }

  public async getReminderStats(): Promise<any> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_reminders,
          COUNT(*) FILTER (WHERE active = true) as active_reminders,
          COUNT(*) FILTER (WHERE repeating = true AND active = true) as repeating_reminders,
          COUNT(DISTINCT user_id) FILTER (WHERE active = true) as users_with_reminders
        FROM reminders
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Error getting reminder stats:', error);
      return null;
    }
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('Reminder checker stopped');
    }
  }
}

export const reminders = ReminderHandler.getInstance();