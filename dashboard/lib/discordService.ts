<<<<<<< HEAD
// dashboard/lib/discordService.ts - Fixed Discord Service
import { Client, GatewayIntentBits, Guild as DiscordJSGuild, GuildChannel, Role as DiscordJSRole, GuildMember, NonThreadGuildBasedChannel, OAuth2Guild } from 'discord.js';
import { ApiChannel, ApiRole, DiscordGuildInfo } from '../types';

const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID || '554266392262737930';
=======
// dashboard/lib/discordService.ts
import { Client, GatewayIntentBits, Guild as DiscordJSEntityGuild, GuildChannel, Role as DiscordJSRole, GuildMember, NonThreadGuildBasedChannel, OAuth2Guild } from 'discord.js'; // Renamed to avoid conflict
import { ApiChannel, ApiRole, GuildWithFullStats } from '@/types/index'; // Using shared types

const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID || '554266392262737930'; // Ensure this is set in your environment for the dashboard

// Define a type for the subset of Guild information we need from Discord API
export interface DiscordGuildInfo {
  id: string;
  name: string;
  iconURL: string | null;
  memberCount: number;
  onlineCount?: number; // Approximate presence count
  ownerId: string;
  description: string | null;
  createdAt: Date;
  features: string[];
}

>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0

class DiscordService {
  private client: Client;
  private isInitialized = false;
  private currentToken: string | null = null;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
<<<<<<< HEAD
        GatewayIntentBits.GuildPresences,
=======
        // GatewayIntentBits.GuildMessages, // Likely not needed for dashboard read-only ops
        // GatewayIntentBits.GuildVoiceStates, // If dashboard manages voice
        GatewayIntentBits.GuildPresences, // For online count
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
      ],
    });
  }

<<<<<<< HEAD
=======
  // Modified initialize to accept a token, or use the bot's token
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
  async initialize(token?: string): Promise<void> {
    if (this.isInitialized && token && this.currentToken === token) return;
    if (this.isInitialized && !token && this.currentToken === process.env.DISCORD_BOT_TOKEN) return;

<<<<<<< HEAD
=======

>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
    const loginToken = token || process.env.DISCORD_BOT_TOKEN;
    this.currentToken = loginToken;

    try {
      if (!loginToken) {
<<<<<<< HEAD
        console.warn('⚠️ Discord bot token not provided - Discord service cannot initialize.');
        this.isInitialized = false;
=======
        console.warn('⚠️ Discord bot token not provided - Discord service cannot fully initialize.');
        this.isInitialized = false; // Mark as not initialized if no token
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
        return;
      }

      await this.client.login(loginToken);
      this.isInitialized = true;
      console.log('✅ Discord service initialized');

      const targetGuild = await this.getGuild(TARGET_GUILD_ID);
      if (targetGuild) {
        console.log(`✅ Target guild found: ${targetGuild.name} (${targetGuild.memberCount} members)`);
      } else {
<<<<<<< HEAD
        console.warn(`⚠️ Target guild ${TARGET_GUILD_ID} not found.`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize Discord service:', error);
      this.isInitialized = false;
    }
  }

  async getGuild(guildId: string): Promise<DiscordJSGuild | null> {
    if (!this.isInitialized || !this.client.isReady()) {
      console.warn(`[DiscordService] Service not ready for guild ${guildId}`);
      return null;
    }

=======
        console.warn(`⚠️ Target guild ${TARGET_GUILD_ID} not found - bot may not be in the guild or token lacks permissions.`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize Discord service:', error);
      this.isInitialized = false; // Ensure it's marked as not initialized on error
    }
  }

  async getGuild(guildId: string): Promise<DiscordJSEntityGuild | null> {
    if (!this.isInitialized && this.client.isReady()) { // Check if client is ready even if full init failed due to TARGET_GUILD
      try {
         return await this.client.guilds.fetch(guildId);
      } catch (fetchError) {
        console.error(`Error fetching guild ${guildId} (client ready, init incomplete):`, fetchError);
        return null;
      }
    }
    if (!this.isInitialized || !this.client.isReady()) { // If not ready, can't fetch
        console.warn(`[DiscordService] Attempted to fetch guild ${guildId} but service is not ready or initialized.`);
        return null;
    }
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
    try {
      return await this.client.guilds.fetch(guildId);
    } catch (error) {
      console.error(`Error fetching guild ${guildId}:`, error);
      return null;
    }
  }

  async getAllGuilds(): Promise<Array<{ id: string; name: string }>> {
    if (!this.isInitialized || !this.client.isReady()) {
<<<<<<< HEAD
      console.warn('[DiscordService] Service not ready for fetching all guilds');
      return [];
    }

    try {
      const guilds = await this.client.guilds.fetch();
      return guilds.map((guild: OAuth2Guild) => ({
=======
        console.warn(`[DiscordService] Attempted to fetch all guilds but service is not ready or initialized.`);
        return [];
    }
    try {
      const guilds = await this.client.guilds.fetch(); // Fetches OAuth2Guild objects
      return guilds.map((guild: OAuth2Guild) => ({ // Explicitly type guild here
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
        id: guild.id,
        name: guild.name
      }));
    } catch (error) {
      console.error('Error fetching all guilds:', error);
      return [];
    }
  }

  async getGuildChannels(guildId: string): Promise<ApiChannel[]> {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild) return this.getMockChannels(); // Fallback to mock if guild not found

      const channels = await guild.channels.fetch();
      return channels
<<<<<<< HEAD
        .filter((channel): channel is NonThreadGuildBasedChannel => 
          channel !== null && !channel.isThread()
        )
=======
        .filter((channel): channel is NonThreadGuildBasedChannel => channel !== null && !channel.isThread())
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
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

  async getGuildRoles(guildId: string): Promise<ApiRole[]> {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild) return this.getMockRoles();

      const roles = await guild.roles.fetch();
      return roles
        .filter((role): role is DiscordJSRole => role !== null)
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
<<<<<<< HEAD
          managed: role.managed,
=======
          managed: role.managed, // Added managed property
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
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
<<<<<<< HEAD
      return guild?.memberCount || 0;
=======
      if (!guild) return 0;
      return guild.memberCount || 0;
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
    } catch (error) {
      console.error(`Error fetching member count for guild ${guildId}:`, error);
      return 0;
    }
  }

  async getGuildInfo(guildId: string): Promise<DiscordGuildInfo | null> {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild) return this.getMockGuildInfo(guildId);

<<<<<<< HEAD
      const onlineCount = guild.presences?.cache.filter(p => p.status !== 'offline').size || 0;
=======
      // Fetch approximate presence count if available through guild object
      // Note: This might require GatewayIntentBits.GuildPresences
      const onlineCount = guild.presences?.cache.filter(p => p.status !== 'offline').size;

>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0

      return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        iconURL: guild.iconURL(),
        memberCount: guild.memberCount,
        onlineCount: onlineCount,
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
<<<<<<< HEAD
      if (error instanceof Error && (error.message.includes('Unknown Member') || (error as any).code === 10007)) {
        // Don't log "Unknown Member" as an error
=======
      // Don't log "Unknown Member" as an error, it's a common case
      if (error instanceof Error && (error.message.includes('Unknown Member') || (error as any).code === 10007) ) {
        // console.debug(`Member ${userId} not found in guild ${guildId}.`);
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
      } else {
        console.error(`Error fetching member ${userId} in guild ${guildId}:`, error);
      }
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
    if (this.client && this.client.isReady()) {
      this.client.destroy();
      this.isInitialized = false;
      this.currentToken = null;
      console.log('🔌 Discord service disconnected');
    }
  }

<<<<<<< HEAD
  // ===== MOCK DATA =====

  private getMockChannels(): ApiChannel[] {
    return [
      { id: 'mock1', name: 'general', type: 0, parentId: null },
      { id: 'mock2', name: 'announcements', type: 0, parentId: null },
=======
  // Mock data for when Discord API is not available or for testing
  private getMockChannels(): ApiChannel[] {
    return [
      { id: 'mockChannel1', name: 'general-mock', type: 0, parentId: null },
      { id: 'mockChannel2', name: 'moderator-logs-mock', type: 0, parentId: null },
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
    ];
  }

  private getMockRoles(): ApiRole[] {
    return [
<<<<<<< HEAD
      { id: 'mock1', name: '@everyone', color: 0, position: 0, managed: false },
      { id: 'mock2', name: 'Admin', color: 0xff0000, position: 10, managed: false },
=======
      { id: 'mockRole1', name: '@everyone-mock', color: 0, position: 0, managed: false },
      { id: 'mockRole2', name: 'Admin-mock', color: 0xff0000, position: 10, managed: false },
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
    ];
  }

  private getMockGuildInfo(guildId: string): DiscordGuildInfo | null {
    if (guildId === TARGET_GUILD_ID) {
      return {
        id: guildId,
        name: 'Test Server (Mock)',
<<<<<<< HEAD
        icon: null,
=======
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
        iconURL: null,
        memberCount: 150,
        onlineCount: 75,
        ownerId: 'mockOwnerId',
        description: 'A mock Discord server for testing.',
        createdAt: new Date('2020-01-01'),
        features: [],
      };
    }
    return null;
  }

<<<<<<< HEAD
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: Record<string, unknown> }> {
    try {
      if (!this.isInitialized || !this.client.isReady()) {
=======
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: Record<string, unknown> }> { // Changed details to Record
    try {
      if (!this.isInitialized || !this.client.isReady()) { // Added !this.client.isReady()
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
        return {
          status: 'unhealthy',
          details: {
            initialized: this.isInitialized,
            ready: this.client.isReady(),
            message: 'Discord service not initialized or not ready'
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
<<<<<<< HEAD
    } catch (error: unknown) {
=======
    } catch (error: unknown) { // Catch unknown
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error during health check',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

<<<<<<< HEAD
  getBotStatus(): Record<string, unknown> {
=======
  getBotStatus(): Record<string, unknown> { // Changed return type
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
    return {
      ready: this.client.isReady(),
      uptime: this.client.uptime,
      ping: this.client.ws.ping,
      guilds: this.client.guilds.cache.size,
      users: this.client.users.cache.size, // This might be low if only a bot token for specific guild is used
      timestamp: new Date().toISOString()
    };
  }

<<<<<<< HEAD
  setupEventListeners(): void {
=======
  setupEventListeners(): void { // No async needed if just attaching listeners
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
    this.client.on('ready', () => {
      console.log(`✅ Discord bot ready as ${this.client.user?.tag}`);
    });

<<<<<<< HEAD
    this.client.on('error', (error: Error) => {
      console.error('❌ Discord client error:', error);
    });

    this.client.on('warn', (warning: string) => {
=======
    this.client.on('error', (error: Error) => { // Explicitly type error
      console.error('❌ Discord client error:', error);
    });

    this.client.on('warn', (warning: string) => { // Explicitly type warning
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
      console.warn('⚠️ Discord client warning:', warning);
    });

    this.client.on('disconnect', () => {
      console.log('🔌 Discord client disconnected');
<<<<<<< HEAD
      this.isInitialized = false;
=======
      this.isInitialized = false; // Reset on disconnect
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
      this.currentToken = null;
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Discord client reconnecting...');
    });

<<<<<<< HEAD
    this.client.on('guildCreate', (guild: DiscordJSGuild) => {
      console.log(`➕ Bot added to guild: ${guild.name} (${guild.id})`);
    });

    this.client.on('guildDelete', (guild: DiscordJSGuild) => {
=======
    this.client.on('guildCreate', (guild: DiscordJSEntityGuild) => { // Explicitly type guild
      console.log(`➕ Bot added to guild: ${guild.name} (${guild.id})`);
    });

    this.client.on('guildDelete', (guild: DiscordJSEntityGuild) => { // Explicitly type guild
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
      console.log(`➖ Bot removed from guild: ${guild.name} (${guild.id})`);
    });
  }
}

export const discordService = new DiscordService();