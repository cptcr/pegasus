import { db } from '../database/connection';
import { config } from '../utils/config';
import monetization from "../monetization.json"

// Discord API Constants
const APPLICATION_ID = monetization.subcommands.application_id;
const CUSTOM_COMMANDS_SKU_ID = monetization.subcommands.sku_id;
const DISCORD_API_BASE = monetization.subcommands.discord_api_base;

export interface DiscordEntitlement {
  id: string;
  sku_id: string;
  application_id: string;
  user_id?: string;
  guild_id?: string;
  type: number;
  deleted: boolean;
  starts_at: string;
  ends_at?: string;
  consumed?: boolean;
}

export interface SubscriptionStatus {
  guild_id: string;
  is_active: boolean;
  current_entitlement_id?: string;
  expires_at?: Date;
  last_checked: Date;
}

export class MonetizationHandler {
  private static instance: MonetizationHandler;
  private pollInterval: NodeJS.Timeout | null = null;

  public static getInstance(): MonetizationHandler {
    if (!MonetizationHandler.instance) {
      MonetizationHandler.instance = new MonetizationHandler();
    }
    return MonetizationHandler.instance;
  }

  // Generate purchase link for guild subscription
  public generatePurchaseLink(guildId: string): string {
    return `https://discord.com/store/skus/${CUSTOM_COMMANDS_SKU_ID}/purchase?guild_id=${guildId}`;
  }

  // Poll Discord entitlements API for a specific guild
  public async pollEntitlementsForGuild(guildId: string): Promise<DiscordEntitlement[]> {
    try {
      const url = `${DISCORD_API_BASE}/applications/${APPLICATION_ID}/entitlements?guild_id=${guildId}&sku_ids=${CUSTOM_COMMANDS_SKU_ID}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bot ${config.BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`Failed to fetch entitlements: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error polling entitlements:', error);
      return [];
    }
  }

  // Update local database with entitlements from Discord API
  public async updateEntitlementsFromAPI(guildId: string): Promise<void> {
    try {
      const entitlements = await this.pollEntitlementsForGuild(guildId);
      
      for (const entitlement of entitlements) {
        if (entitlement.deleted) {
          // Mark as deleted/expired
          await db.query(
            'UPDATE discord_entitlements SET consumed = true, updated_at = CURRENT_TIMESTAMP WHERE entitlement_id = $1',
            [entitlement.id]
          );
          continue;
        }

        // Insert or update entitlement
        await db.query(
          `INSERT INTO discord_entitlements 
           (entitlement_id, guild_id, sku_id, application_id, type, starts_at, ends_at, consumed, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
           ON CONFLICT (entitlement_id) 
           DO UPDATE SET 
             ends_at = $7,
             consumed = $8,
             updated_at = CURRENT_TIMESTAMP`,
          [
            entitlement.id,
            entitlement.guild_id,
            entitlement.sku_id,
            entitlement.application_id,
            entitlement.type,
            new Date(entitlement.starts_at),
            entitlement.ends_at ? new Date(entitlement.ends_at) : null,
            entitlement.consumed || false
          ]
        );
      }

      // Update subscription status
      await this.updateSubscriptionStatus(guildId);
    } catch (error) {
      console.error('Error updating entitlements from API:', error);
    }
  }

  // Check if guild has active premium subscription
  public async isGuildPremium(guildId: string): Promise<boolean> {
    try {
      // First try to get from cache
      const cachedStatus = await db.query(
        'SELECT is_active, expires_at, last_checked FROM subscription_status WHERE guild_id = $1',
        [guildId]
      );

      // If cache is recent (less than 1 hour old), use it
      if (cachedStatus.rows.length > 0) {
        const status = cachedStatus.rows[0];
        const lastChecked = new Date(status.last_checked);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        if (lastChecked > oneHourAgo) {
          // Check if still active based on expiry
          if (status.expires_at && new Date() > new Date(status.expires_at)) {
            await this.updateSubscriptionStatus(guildId, false);
            return false;
          }
          return status.is_active;
        }
      }

      // Cache is stale, update from API
      await this.updateEntitlementsFromAPI(guildId);
      
      // Get updated status
      const updatedStatus = await db.query(
        'SELECT is_active FROM subscription_status WHERE guild_id = $1',
        [guildId]
      );

      return updatedStatus.rows.length > 0 ? updatedStatus.rows[0].is_active : false;
    } catch (error) {
      console.error('Error checking guild premium status:', error);
      return false;
    }
  }

  // Update subscription status based on current entitlements
  private async updateSubscriptionStatus(guildId: string, forceInactive = false): Promise<void> {
    try {
      if (forceInactive) {
        await db.query(
          `INSERT INTO subscription_status (guild_id, is_active, last_checked, updated_at)
           VALUES ($1, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (guild_id) 
           DO UPDATE SET 
             is_active = false,
             current_entitlement_id = NULL,
             expires_at = NULL,
             last_checked = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP`,
          [guildId]
        );
        return;
      }

      // Find active entitlements for this guild
      const activeEntitlements = await db.query(
        `SELECT entitlement_id, starts_at, ends_at 
         FROM discord_entitlements 
         WHERE guild_id = $1 
           AND sku_id = $2 
           AND consumed = false 
           AND starts_at <= CURRENT_TIMESTAMP 
           AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
         ORDER BY starts_at DESC 
         LIMIT 1`,
        [guildId, CUSTOM_COMMANDS_SKU_ID]
      );

      const isActive = activeEntitlements.rows.length > 0;
      const currentEntitlement = activeEntitlements.rows[0];

      await db.query(
        `INSERT INTO subscription_status 
         (guild_id, is_active, current_entitlement_id, expires_at, last_checked, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (guild_id) 
         DO UPDATE SET 
           is_active = $2,
           current_entitlement_id = $3,
           expires_at = $4,
           last_checked = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP`,
        [
          guildId,
          isActive,
          currentEntitlement?.entitlement_id || null,
          currentEntitlement?.ends_at || null
        ]
      );
    } catch (error) {
      console.error('Error updating subscription status:', error);
    }
  }

  // Get subscription status for guild
  public async getSubscriptionStatus(guildId: string): Promise<SubscriptionStatus | null> {
    try {
      // Update from API first
      await this.updateEntitlementsFromAPI(guildId);
      
      const result = await db.query(
        'SELECT * FROM subscription_status WHERE guild_id = $1',
        [guildId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        guild_id: row.guild_id,
        is_active: row.is_active,
        current_entitlement_id: row.current_entitlement_id,
        expires_at: row.expires_at ? new Date(row.expires_at) : undefined,
        last_checked: new Date(row.last_checked)
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return null;
    }
  }

  // Get entitlement details for guild
  public async getEntitlementDetails(guildId: string): Promise<any> {
    try {
      const result = await db.query(
        `SELECT e.*, s.is_active 
         FROM discord_entitlements e
         LEFT JOIN subscription_status s ON e.guild_id = s.guild_id
         WHERE e.guild_id = $1 AND e.sku_id = $2
         ORDER BY e.starts_at DESC`,
        [guildId, CUSTOM_COMMANDS_SKU_ID]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting entitlement details:', error);
      return [];
    }
  }

  // Start polling all guilds for entitlements (daily check)
  public startEntitlementPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    // Poll every 24 hours
    this.pollInterval = setInterval(async () => {
      await this.pollAllGuilds();
    }, 24 * 60 * 60 * 1000);

    // Run initial poll
    this.pollAllGuilds();
  }

  // Poll all guilds that have or had subscriptions
  private async pollAllGuilds(): Promise<void> {
    try {
      console.log('Starting daily entitlement polling...');
      
      const guildsToCheck = await db.query(
        'SELECT DISTINCT guild_id FROM subscription_status UNION SELECT DISTINCT guild_id FROM discord_entitlements'
      );

      for (const guild of guildsToCheck.rows) {
        await this.updateEntitlementsFromAPI(guild.guild_id);
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`Completed entitlement polling for ${guildsToCheck.rows.length} guilds`);
    } catch (error) {
      console.error('Error during entitlement polling:', error);
    }
  }

  // Stop polling
  public stopEntitlementPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // Clean up expired entitlements
  public async cleanupExpiredEntitlements(): Promise<void> {
    try {
      // Mark expired entitlements as consumed
      await db.query(
        'UPDATE discord_entitlements SET consumed = true WHERE ends_at IS NOT NULL AND ends_at < CURRENT_TIMESTAMP AND consumed = false'
      );

      // Update subscription status for expired subscriptions
      const expiredGuilds = await db.query(
        'SELECT guild_id FROM subscription_status WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP AND is_active = true'
      );

      for (const guild of expiredGuilds.rows) {
        await this.updateSubscriptionStatus(guild.guild_id, true);
      }

      console.log(`Cleaned up expired entitlements for ${expiredGuilds.rows.length} guilds`);
    } catch (error) {
      console.error('Error cleaning up expired entitlements:', error);
    }
  }

  // Get subscription statistics
  public async getSubscriptionStats(): Promise<any> {
    try {
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total_subscriptions,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_subscriptions,
          COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_subscriptions
        FROM subscription_status
      `);

      const customCommandUsage = await db.query(`
        SELECT 
          COUNT(*) as total_custom_commands,
          AVG(usage_count) as avg_usage_per_command
        FROM custom_commands 
        WHERE enabled = true
      `);

      return {
        subscriptions: stats.rows[0],
        customCommands: customCommandUsage.rows[0]
      };
    } catch (error) {
      console.error('Error getting subscription stats:', error);
      return null;
    }
  }
}

export const monetizationHandler = MonetizationHandler.getInstance();