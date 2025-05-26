// dashboard/lib/database.ts
import { PrismaClient, Guild, User, Poll, Giveaway, Ticket, LevelReward, Prisma } from '@prisma/client';
import { EventEmitter } from 'events';
import {discordService} from './discordService';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

class DatabaseService extends EventEmitter {
  constructor() {
    super();
  }

  // --- Guild Methods ---

  async getGuild(guildId: string): Promise<Guild | null> {
    return prisma.guild.findUnique({ where: { id: guildId } });
  }

  async getGuildWithFullData(guildId: string) {
    return prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        members: { include: { warnings: true, userLevels: true } },
        warnings: true,
        polls: { include: { options: true, votes: true } },
        giveaways: { include: { entries: true } },
        tickets: true,
        logs: true,
        levelRewards: true,
        autoModRules: true,
      },
    });
  }

  // IMPLEMENTED
  async getGuildWithFullStats(guildId: string) {
    const [guildData, discordGuild] = await Promise.all([
      this.getGuildWithFullData(guildId),
      discordService.getGuildInfo(guildId)
    ]);

    if (!guildData || !discordGuild) return null;

    const memberCount = discordGuild.memberCount || 0;
    const onlineCount = discordGuild.approximate_presence_count || 0;

    return {
      ...guildData,
      stats: {
        memberCount,
        onlineCount,
        ticketCount: guildData.tickets.length,
        pollCount: guildData.polls.length,
        giveawayCount: guildData.giveaways.length,
        warningCount: guildData.warnings.length,
      },
      discord: discordGuild
    };
  }

  async createGuildWithDefaults(guildId: string, name: string) {
    return prisma.guild.create({
      data: {
        id: guildId,
        name: name,
        settings: {
          logChannel: null,
          quarantineRole: null,
        },
      },
    });
  }
  
  // IMPLEMENTED
  async syncGuild(guildId: string, name: string) {
    return prisma.guild.upsert({
      where: { id: guildId },
      update: { name },
      create: {
        id: guildId,
        name: name,
        settings: {
          logChannel: null,
          quarantineRole: null,
        },
      },
    });
  }

  // --- Settings Methods ---

  async getGuildSettings(guildId: string) {
    const guild = await this.getGuild(guildId);
    return guild?.settings as Prisma.JsonObject | null;
  }

  async updateGuildSettings(guildId: string, settings: any) {
    const currentGuild = await this.getGuild(guildId);
    if (!currentGuild) {
      throw new Error("Guild not found");
    }
    const currentSettings = (currentGuild.settings as Prisma.JsonObject) || {};
    const updatedSettings = { ...currentSettings, ...settings };

    const result = await prisma.guild.update({
      where: { id: guildId },
      data: { settings: updatedSettings },
    });
    this.emit('guild:updated', result);
    return result;
  }
  
  // --- Moderation Data ---
  async getModerationData(guildId: string) {
    const warnings = await prisma.warning.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, take: 20 });
    const quarantinedUsers = await prisma.quarantine.findMany({ where: { guildId, active: true }, orderBy: { quarantinedAt: 'desc' } });
    const autoModRules = await prisma.autoModRule.findMany({ where: { guildId } });
    return { warnings, quarantinedUsers, autoModRules };
  }

  // --- Leveling Data ---
  async getLevelData(guildId: string) {
    const userLevels = await prisma.userLevel.findMany({ where: { guildId }, orderBy: { xp: 'desc' }, take: 25 });
    const levelRewards = await prisma.levelReward.findMany({ where: { guildId }, orderBy: { level: 'asc' } });
    return { userLevels, levelRewards };
  }
  
  // Placeholder for the unimplemented createGuild method to avoid crashes
  async createGuild(guildId: string, name: string): Promise<Guild> {
    this.emit('guild:created', { guildId, name });
    return this.createGuildWithDefaults(guildId, name);
  }
}

const databaseEvents = new DatabaseService();
export default databaseEvents;