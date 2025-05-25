// dashboard/lib/discordService.ts
import { Client, GatewayIntentBits, Guild, GuildChannel, Role, GuildMember, NonThreadGuildBasedChannel } from 'discord.js';

const TARGET_GUILD_ID = '554266392262737930';

class DiscordService {
  private client: Client;
  private isInitialized = false;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      if (!process.env.DISCORD_BOT_TOKEN) {
        console.warn('⚠️ Discord bot token not provided - running in mock mode');
        return;
      }

      await this.client.login(process.env.DISCORD_BOT_TOKEN);
      this.isInitialized = true;
      console.log('✅ Discord service initialized');
      
      // Log the target guild status
      const targetGuild = await this.getGuild(TARGET_GUILD_ID);
      if (targetGuild) {
        console.log(`✅ Target guild found: ${targetGuild.name} (${targetGuild.memberCount} members)`);
      } else {
        console.warn(`⚠️ Target guild ${TARGET_GUILD_ID} not found - bot may not be in the guild`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize Discord service:', error);
      console.warn('⚠️ Discord service will run in mock mode');
    }
  }

  async getGuild(guildId: string): Promise<Guild | null> {
    try {
      if (!this.isInitialized) return null;
      return await this.client.guilds.fetch(guildId);
    } catch (error) {
      console.error(`Error fetching guild ${guildId}:`, error);
      return null;
    }
  }

  async getAllGuilds(): Promise<Array<{ id: string; name: string }>> {
    try {
      if (!this.isInitialized) return [];
      
      const guilds = await this.client.guilds.fetch();
      return guilds.map(guild => ({
        id: guild.id,
        name: guild.name
      }));
    } catch (error) {
      console.error('Error fetching all guilds:', error);
      return [];
    }
  }

  async getGuildChannels(guildId: string) {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild) return this.getMockChannels();

      const channels = await guild.channels.fetch();
      return channels
        .filter((channel): channel is NonThreadGuildBasedChannel => channel !== null && !(channel.isThread?.()))
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          parentId: channel.parentId,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error(`Error fetching channels for guild ${guildId}:`, error);
      return this.getMockChannels();
    }
  }

  async getGuildRoles(guildId: string) {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild) return this.getMockRoles();

      const roles = await guild.roles.fetch();
      return roles
        .filter((role): role is Role => role !== null)
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
        }))
        .sort((a, b) => b.position - a.position);
    } catch (error) {
      console.error(`Error fetching roles for guild ${guildId}:`, error);
      return this.getMockRoles();
    }
  }

  async getGuildMemberCount(guildId: string): Promise<number> {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild) return 0;

      return guild.memberCount || 0;
    } catch (error) {
      console.error(`Error fetching member count for guild ${guildId}:`, error);
      return 0;
    }
  }

  async getGuildInfo(guildId: string) {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild) return this.getMockGuildInfo(guildId);

      return {
        id: guild.id,
        name: guild.name,
        iconURL: guild.iconURL(),
        memberCount: guild.memberCount,
        ownerId: guild.ownerId,
        description: guild.description,
        createdAt: guild.createdAt,
        features: guild.features,
      };
    } catch (error) {
      console.error(`Error fetching guild info for ${guildId}:`, error);
      return this.getMockGuildInfo(guildId);
    }
  }

  async getGuildMember(guildId: string, userId: string): Promise<GuildMember | null> {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild) return null;

      return await guild.members.fetch(userId);
    } catch (error) {
      console.error(`Error fetching member ${userId} in guild ${guildId}:`, error);
      return null;
    }
  }

  async checkUserPermissions(guildId: string, userId: string, requiredRoleId: string): Promise<boolean> {
    try {
      const member = await this.getGuildMember(guildId, userId);
      if (!member) return false;

      return member.roles.cache.has(requiredRoleId);
    } catch (error) {
      console.error(`Error checking permissions for user ${userId}:`, error);
      return false;
    }
  }

  isReady(): boolean {
    return this.client.isReady();
  }

  getClient(): Client {
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.isInitialized = false;
      console.log('🔌 Discord service disconnected');
    }
  }

  // Mock data for when Discord API is not available
  private getMockChannels() {
    return [
      { id: '123456789', name: 'general', type: 0, parentId: null },
      { id: '123456790', name: 'moderator-logs', type: 0, parentId: null },
      { id: '123456791', name: 'level-ups', type: 0, parentId: null },
      { id: '123456792', name: 'geizhals-alerts', type: 0, parentId: null },
      { id: '123456793', name: 'welcome', type: 0, parentId: null },
      { id: '123456794', name: 'General Voice', type: 2, parentId: null },
      { id: '123456795', name: 'Text Channels', type: 4, parentId: null },
      { id: '123456796', name: 'Voice Channels', type: 4, parentId: null },
    ];
  }

  private getMockRoles() {
    return [
      { id: '987654321', name: '@everyone', color: 0, position: 0 },
      { id: '797927858420187186', name: 'Admin', color: 0xff0000, position: 10 },
      { id: '987654322', name: 'Moderator', color: 0xff5500, position: 5 },
      { id: '987654323', name: 'Member', color: 0x00ff00, position: 1 },
      { id: '987654324', name: 'Level 10', color: 0x0000ff, position: 2 },
      { id: '987654325', name: 'Level 25', color: 0xff00ff, position: 3 },
      { id: '987654326', name: 'Level 50', color: 0xffff00, position: 4 },
    ];
  }

  private getMockGuildInfo(guildId: string) {
    // Only return mock info for the target guild
    if (guildId === TARGET_GUILD_ID) {
      return {
        id: guildId,
        name: 'Test Server',
        iconURL: null,
        memberCount: 150,
        ownerId: '123456789',
        description: 'A Discord server for testing the Hinko bot',
        createdAt: new Date('2020-01-01'),
        features: [],
      };
    }
    return null;
  }

  // Health check methods
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      if (!this.isInitialized) {
        return {
          status: 'unhealthy',
          details: {
            initialized: false,
            message: 'Discord service not initialized'
          }
        };
      }

      const guild = await this.getGuild(TARGET_GUILD_ID);
      
      return {
        status: guild ? 'healthy' : 'unhealthy',
        details: {
          initialized: this.isInitialized,
          botReady: this.client.isReady(),
          targetGuildFound: !!guild,
          targetGuildName: guild?.name || 'Not found',
          targetGuildMembers: guild?.memberCount || 0,
          uptime: this.client.uptime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Bot status monitoring
  getBotStatus() {
    return {
      ready: this.client.isReady(),
      uptime: this.client.uptime,
      ping: this.client.ws.ping,
      guilds: this.client.guilds.cache.size,
      users: this.client.users.cache.size,
      timestamp: new Date().toISOString()
    };
  }

  // Event listeners for monitoring
  setupEventListeners() {
    this.client.on('ready', () => {
      console.log(`✅ Discord bot ready as ${this.client.user?.tag}`);
    });

    this.client.on('error', (error) => {
      console.error('❌ Discord client error:', error);
    });

    this.client.on('warn', (warning) => {
      console.warn('⚠️ Discord client warning:', warning);
    });

    this.client.on('disconnect', () => {
      console.log('🔌 Discord client disconnected');
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Discord client reconnecting...');
    });

    this.client.on('guildCreate', (guild) => {
      console.log(`➕ Bot added to guild: ${guild.name} (${guild.id})`);
    });

    this.client.on('guildDelete', (guild) => {
      console.log(`➖ Bot removed from guild: ${guild.name} (${guild.id})`);
    });
  }
}

// Singleton instance
export const discordService = new DiscordService();