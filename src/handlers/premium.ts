import { db } from '../database/connection';

export interface PremiumGuild {
  guild_id: string;
  tier: 'basic' | 'premium' | 'enterprise';
  features: string[];
  expires_at?: Date;
  activated_by: string;
  activated_at: Date;
  updated_at: Date;
}

export interface CustomCommand {
  id: string;
  guild_id: string;
  command_name: string;
  parent_command: string;
  subcommand_name: string;
  description: string;
  creator_id: string;
  response_type: 'embed' | 'text';
  response_data: any;
  enabled: boolean;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface GuildCommand {
  id: string;
  guild_id: string;
  command_name: string;
  description: string;
  creator_id: string;
  response_type: 'embed' | 'text';
  response_data: any;
  enabled: boolean;
  usage_count: number;
  discord_command_id?: string;
  created_at: Date;
  updated_at: Date;
}

export class PremiumHandler {
  private static instance: PremiumHandler;
  private premiumFeatures = {
    basic: [],
    premium: ['custom_commands', 'advanced_logging', 'priority_support'],
    enterprise: ['custom_commands', 'advanced_logging', 'priority_support', 'custom_branding', 'api_access']
  };

  public static getInstance(): PremiumHandler {
    if (!PremiumHandler.instance) {
      PremiumHandler.instance = new PremiumHandler();
    }
    return PremiumHandler.instance;
  }

  // Check if guild has premium access (using Discord monetization)
  public async isPremiumGuild(guildId: string): Promise<boolean> {
    try {
      // Import here to avoid circular dependency
      const { monetizationHandler } = await import('./monetization');
      return await monetizationHandler.isGuildPremium(guildId);
    } catch (error) {
      console.error('Error checking premium status:', error);
      return false;
    }
  }

  // Check if guild has specific feature access
  public async hasFeature(guildId: string, feature: string): Promise<boolean> {
    try {
      // For custom commands, check Discord monetization
      if (feature === 'custom_commands') {
        return await this.isPremiumGuild(guildId);
      }

      // For other features, use legacy system or default to premium check
      return await this.isPremiumGuild(guildId);
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  // Grant premium access to guild
  public async grantPremium(guildId: string, tier: string, activatedBy: string, expiresAt?: Date): Promise<boolean> {
    try {
      await db.query(
        `INSERT INTO premium_guilds (guild_id, tier, expires_at, activated_by) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id) 
         DO UPDATE SET tier = $2, expires_at = $3, updated_at = CURRENT_TIMESTAMP`,
        [guildId, tier, expiresAt, activatedBy]
      );
      return true;
    } catch (error) {
      console.error('Error granting premium:', error);
      return false;
    }
  }

  // Create custom command (legacy subcommands)
  public async createCustomCommand(
    guildId: string,
    parentCommand: string,
    subcommandName: string,
    description: string,
    creatorId: string,
    responseType: 'embed' | 'text',
    responseData: any
  ): Promise<{ success: boolean; message: string; commandId?: string }> {
    try {
      // Check premium access
      if (!await this.hasFeature(guildId, 'custom_commands')) {
        return { success: false, message: 'This server does not have access to custom commands. Upgrade to premium!' };
      }

      // Check command limits based on tier
      const commandCount = await this.getCustomCommandCount(guildId);
      const maxCommands = await this.getMaxCustomCommands(guildId);
      
      if (commandCount >= maxCommands) {
        return { success: false, message: `Maximum custom commands reached (${maxCommands}). Upgrade your tier for more commands!` };
      }

      // Validate response data
      if (responseType === 'embed') {
        if (!responseData.title && !responseData.description) {
          return { success: false, message: 'Embed must have at least a title or description.' };
        }
      } else if (responseType === 'text') {
        if (!responseData.content || responseData.content.trim().length === 0) {
          return { success: false, message: 'Text response cannot be empty.' };
        }
      }

      const result = await db.query(
        `INSERT INTO custom_commands ("guildId", name, parent_command, subcommand_name, description, "creatorId", response_type, response_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [guildId, `${parentCommand}_${subcommandName}`, parentCommand, subcommandName, description, creatorId, responseType, JSON.stringify(responseData)]
      );

      return { 
        success: true, 
        message: 'Custom command created successfully!', 
        commandId: result.rows[0].id 
      };
    } catch (error) {
      if ((error as any).code === '23505') { // Unique constraint violation
        return { success: false, message: 'A custom command with this name already exists in this server.' };
      }
      console.error('Error creating custom command:', error);
      return { success: false, message: 'Failed to create custom command.' };
    }
  }

  // Create guild command (new guild-installed commands)
  public async createGuildCommand(
    guildId: string,
    commandName: string,
    description: string,
    creatorId: string,
    responseType: 'embed' | 'text',
    responseData: any
  ): Promise<{ success: boolean; message: string; commandId?: string }> {
    try {
      // Check premium access
      if (!await this.hasFeature(guildId, 'custom_commands')) {
        return { success: false, message: 'This guild does not have access to custom commands. Upgrade to premium!' };
      }

      // Check command limits based on tier
      const commandCount = await this.getGuildCommandCount(guildId);
      const maxCommands = await this.getMaxCustomCommands(guildId);
      
      if (commandCount >= maxCommands) {
        return { success: false, message: `Maximum custom commands reached (${maxCommands}). Upgrade your tier for more commands!` };
      }

      // Validate response data
      if (responseType === 'embed') {
        if (!responseData.title && !responseData.description) {
          return { success: false, message: 'Embed must have at least a title or description.' };
        }
      } else if (responseType === 'text') {
        if (!responseData.content || responseData.content.trim().length === 0) {
          return { success: false, message: 'Text response cannot be empty.' };
        }
      }

      // Register the command with Discord's API
      const { guildCommandHandler } = await import('./guildCommands');
      const discordCommandId = await guildCommandHandler.registerGuildCommand(guildId, commandName, description);
      
      if (!discordCommandId) {
        return { success: false, message: 'Failed to register command with Discord. Please try again.' };
      }

      const result = await db.query(
        `INSERT INTO guild_commands (guild_id, command_name, description, creator_id, response_type, response_data, discord_command_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [guildId, commandName, description, creatorId, responseType, JSON.stringify(responseData), discordCommandId]
      );

      return { 
        success: true, 
        message: 'Guild command created successfully!', 
        commandId: result.rows[0].id 
      };
    } catch (error) {
      if ((error as any).code === '23505') { // Unique constraint violation
        return { success: false, message: 'A custom command with this name already exists in this guild.' };
      }
      console.error('Error creating guild command:', error);
      return { success: false, message: 'Failed to create guild command.' };
    }
  }

  // Get custom commands for guild (legacy subcommands)
  public async getCustomCommands(guildId: string, parentCommand?: string): Promise<CustomCommand[]> {
    try {
      let query = 'SELECT * FROM custom_commands WHERE "guildId" = $1 AND enabled = true';
      const params = [guildId];

      if (parentCommand) {
        query += ' AND name LIKE $2';
        params.push(`${parentCommand}_%`);
      }

      query += ' ORDER BY created_at DESC';

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching custom commands:', error);
      return [];
    }
  }

  // Get guild commands (new guild-installed commands)
  public async getGuildCommands(guildId: string): Promise<GuildCommand[]> {
    try {
      const result = await db.query(
        'SELECT * FROM guild_commands WHERE guild_id = $1 AND enabled = true ORDER BY created_at DESC',
        [guildId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching guild commands:', error);
      return [];
    }
  }

  // Execute custom command
  public async executeCustomCommand(guildId: string, parentCommand: string, subcommandName: string): Promise<any> {
    try {
      const result = await db.query(
        'SELECT * FROM custom_commands WHERE "guildId" = $1 AND parent_command = $2 AND subcommand_name = $3 AND enabled = true',
        [guildId, parentCommand, subcommandName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const command = result.rows[0];

      // Increment usage count
      await db.query(
        'UPDATE custom_commands SET uses = uses + 1 WHERE id = $1',
        [command.id]
      );

      const responseData = JSON.parse(command.response);
      return {
        type: responseData.type,
        data: responseData.data
      };
    } catch (error) {
      console.error('Error executing custom command:', error);
      return null;
    }
  }

  // Delete custom command (legacy subcommands)
  public async deleteCustomCommand(guildId: string, commandId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await db.query(
        'DELETE FROM custom_commands WHERE id = $1 AND "guildId" = $2 AND "creatorId" = $3 RETURNING id',
        [commandId, guildId, userId]
      );

      if (result.rows.length === 0) {
        return { success: false, message: 'Custom command not found or you do not have permission to delete it.' };
      }

      return { success: true, message: 'Custom command deleted successfully!' };
    } catch (error) {
      console.error('Error deleting custom command:', error);
      return { success: false, message: 'Failed to delete custom command.' };
    }
  }

  // Delete guild command (new guild-installed commands)
  public async deleteGuildCommand(guildId: string, commandId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get the command info first
      const commandResult = await db.query(
        'SELECT discord_command_id FROM guild_commands WHERE id = $1 AND guild_id = $2 AND creator_id = $3',
        [commandId, guildId, userId]
      );

      if (commandResult.rows.length === 0) {
        return { success: false, message: 'Guild command not found or you do not have permission to delete it.' };
      }

      const discordCommandId = commandResult.rows[0].discord_command_id;
      
      // Unregister the command from Discord's API
      if (discordCommandId) {
        const { guildCommandHandler } = await import('./guildCommands');
        await guildCommandHandler.unregisterGuildCommand(guildId, discordCommandId);
      }

      const result = await db.query(
        'DELETE FROM guild_commands WHERE id = $1 AND guild_id = $2 AND creator_id = $3 RETURNING id',
        [commandId, guildId, userId]
      );

      return { success: true, message: 'Guild command deleted successfully!' };
    } catch (error) {
      console.error('Error deleting guild command:', error);
      return { success: false, message: 'Failed to delete guild command.' };
    }
  }

  // Get custom command count for guild (legacy subcommands)
  private async getCustomCommandCount(guildId: string): Promise<number> {
    try {
      const result = await db.query(
        'SELECT COUNT(*) as count FROM custom_commands WHERE "guildId" = $1 AND enabled = true',
        [guildId]
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting command count:', error);
      return 0;
    }
  }

  // Get guild command count (new guild-installed commands)
  private async getGuildCommandCount(guildId: string): Promise<number> {
    try {
      const result = await db.query(
        'SELECT COUNT(*) as count FROM guild_commands WHERE guild_id = $1 AND enabled = true',
        [guildId]
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting guild command count:', error);
      return 0;
    }
  }

  // Get maximum custom commands allowed for guild
  private async getMaxCustomCommands(guildId: string): Promise<number> {
    try {
      // With Discord monetization, all subscribed guilds get the same limit
      const isPremium = await this.isPremiumGuild(guildId);
      return isPremium ? 50 : 0; // 50 commands for subscribed guilds
    } catch (error) {
      console.error('Error getting max commands:', error);
      return 0;
    }
  }

  // Get premium info for guild (using Discord monetization)
  public async getPremiumInfo(guildId: string): Promise<any> {
    try {
      // Import here to avoid circular dependency
      const { monetizationHandler } = await import('./monetization');
      
      const isPremium = await monetizationHandler.isGuildPremium(guildId);
      const subscriptionStatus = await monetizationHandler.getSubscriptionStatus(guildId);
      
      return {
        isPremium,
        tier: isPremium ? 'premium' : 'basic',
        features: isPremium ? this.premiumFeatures.premium : [],
        expiresAt: subscriptionStatus?.expires_at || null,
        maxCustomCommands: await this.getMaxCustomCommands(guildId),
        currentCustomCommands: await this.getCustomCommandCount(guildId),
        currentGuildCommands: await this.getGuildCommandCount(guildId),
        subscriptionStatus: subscriptionStatus
      };
    } catch (error) {
      console.error('Error getting premium info:', error);
      return {
        isPremium: false,
        tier: 'basic',
        features: [],
        maxCustomCommands: 0,
        currentCustomCommands: 0,
        currentGuildCommands: 0,
        subscriptionStatus: null
      };
    }
  }

  // Execute guild command (new guild-installed commands)
  public async executeGuildCommand(guildId: string, commandName: string): Promise<any> {
    try {
      const result = await db.query(
        'SELECT * FROM guild_commands WHERE guild_id = $1 AND command_name = $2 AND enabled = true',
        [guildId, commandName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const command = result.rows[0];

      // Increment usage count
      await db.query(
        'UPDATE guild_commands SET usage_count = usage_count + 1 WHERE id = $1',
        [command.id]
      );

      return {
        type: command.response_type,
        data: command.response_data
      };
    } catch (error) {
      console.error('Error executing guild command:', error);
      return null;
    }
  }

  // Update guild command Discord ID
  public async updateGuildCommandDiscordId(commandId: string, discordCommandId: string): Promise<void> {
    try {
      await db.query(
        'UPDATE guild_commands SET discord_command_id = $1 WHERE id = $2',
        [discordCommandId, commandId]
      );
    } catch (error) {
      console.error('Error updating guild command Discord ID:', error);
    }
  }
}

export const premiumHandler = PremiumHandler.getInstance();