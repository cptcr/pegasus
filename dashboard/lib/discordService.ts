// dashboard/lib/discordService.ts
import { Client, GatewayIntentBits, Guild, GuildChannel, Role, GuildMember } from 'discord.js';

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
        .filter((channel): channel is GuildChannel => channel !== null)
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

  isReady(): boolean {
    return this.client.isReady();
  }

  getClient(): Client {
    return this.client;
  }

  // Mock data for when Discord API is not available
  private getMockChannels() {
    return [
      { id: '123456789', name: 'general', type: 0, parentId: null },
      { id: '123456790', name: 'moderator-logs', type: 0, parentId: null },
      { id: '123456791', name: 'level-ups', type: 0, parentId: null },
      { id: '123456792', name: 'General Voice', type: 2, parentId: null },
      { id: '123456793', name: 'Text Channels', type: 4, parentId: null },
    ];
  }

  private getMockRoles() {
    return [
      { id: '987654321', name: '@everyone', color: 0, position: 0 },
      { id: '987654322', name: 'Moderator', color: 0xff0000, position: 5 },
      { id: '987654323', name: 'Member', color: 0x00ff00, position: 1 },
      { id: '987654324', name: 'Level 10', color: 0x0000ff, position: 2 },
    ];
  }

  private getMockGuildInfo(guildId: string) {
    return {
      id: guildId,
      name: 'Test Server',
      iconURL: null,
      memberCount: 150,
      ownerId: '123456789',
      description: 'A test server for development',
      createdAt: new Date(),
      features: [],
    };
  }
}

// Singleton instance
export const discordService = new DiscordService();