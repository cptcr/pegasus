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
      await this.client.login(process.env.DISCORD_BOT_TOKEN);
      this.isInitialized = true;
      console.log('✅ Discord service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Discord service:', error);
      throw error;
    }
  }

  async getGuild(guildId: string): Promise<Guild | null> {
    try {
      return await this.client.guilds.fetch(guildId);
    } catch (error) {
      console.error(`Error fetching guild ${guildId}:`, error);
      return null;
    }
  }

  async getGuildChannels(guildId: string) {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild) return [];

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
      return [];
    }
  }

  async getGuildRoles(guildId: string) {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild) return [];

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
      return [];
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

  async getGuildMembers(guildId: string, limit: number = 100) {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild) return [];

      const members = await guild.members.fetch({ limit });
      return members.map(member => ({
        id: member.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        displayName: member.displayName,
        joinedAt: member.joinedAt,
        roles: member.roles.cache.map(role => role.id),
      }));
    } catch (error) {
      console.error(`Error fetching members for guild ${guildId}:`, error);
      return [];
    }
  }

  async getUserById(userId: string) {
    try {
      return await this.client.users.fetch(userId);
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return null;
    }
  }

  async getGuildInfo(guildId: string) {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild) return null;

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
      return null;
    }
  }

  async getAllGuilds() {
    try {
      const guilds = await this.client.guilds.fetch();
      return guilds.map(guild => ({
        id: guild.id,
        name: guild.name,
        iconURL: guild.iconURL(),
        memberCount: guild.memberCount,
      }));
    } catch (error) {
      console.error('Error fetching all guilds:', error);
      return [];
    }
  }

  isReady(): boolean {
    return this.client.isReady();
  }

  getClient(): Client {
    return this.client;
  }
}

// Singleton instance
export const discordService = new DiscordService();