import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export class DatabaseService {
  static prisma = prisma;

  // Initialisierung
  static async initialize() {
    await prisma.$connect();
    console.log('✅ Datenbank verbunden');
  }

  static async disconnect() {
    await prisma.$disconnect();
    console.log('🔌 Datenbank getrennt');
  }

  // Guild Settings
  static async getGuildSettings(guildId: string) {
    return await prisma.guild.upsert({
      where: { id: guildId },
      update: {},
      create: {
        id: guildId,
        name: 'Unknown Guild',
      },
    });
  }

  static async updateGuildSettings(guildId: string, data: any) {
    return await prisma.guild.update({
      where: { id: guildId },
      data,
    });
  }

  // User Management
  static async getOrCreateUser(userId: string, username: string) {
    return await prisma.user.upsert({
      where: { id: userId },
      update: { username },
      create: {
        id: userId,
        username,
      },
    });
  }

  // Warn System
  static async addWarn(data: {
    userId: string;
    guildId: string;
    moderatorId: string;
    reason: string;
  }) {
    return await prisma.warn.create({
      data,
      include: {
        user: true,
        moderator: true,
      },
    });
  }

  static async getActiveWarns(userId: string, guildId: string) {
    return await prisma.warn.findMany({
      where: {
        userId,
        guildId,
        active: true,
      },
      include: {
        moderator: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async removeWarn(warnId: number) {
    return await prisma.warn.update({
      where: { id: warnId },
      data: { active: false },
    });
  }

  static async clearWarns(userId: string, guildId: string) {
    return await prisma.warn.updateMany({
      where: {
        userId,
        guildId,
        active: true,
      },
      data: { active: false },
    });
  }

  // Level System
  static async getUserLevel(userId: string, guildId: string) {
    return await prisma.userLevel.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      update: {},
      create: {
        userId,
        guildId,
      },
      include: {
        user: true,
      },
    });
  }

  static async addXP(userId: string, guildId: string, xpToAdd: number) {
    const userLevel = await this.getUserLevel(userId, guildId);
    const newXP = userLevel.xp + xpToAdd;
    const newLevel = this.calculateLevel(newXP);
    
    const leveledUp = newLevel > userLevel.level;

    const updated = await prisma.userLevel.update({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      data: {
        xp: newXP,
        level: newLevel,
        lastMessageTime: new Date(),
      },
      include: {
        user: true,
      },
    });

    return { userLevel: updated, leveledUp, oldLevel: userLevel.level };
  }

  static async addMessage(userId: string, guildId: string) {
    return await prisma.userLevel.update({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      data: {
        messages: {
          increment: 1,
        },
      },
    });
  }

  static async addVoiceTime(userId: string, guildId: string, seconds: number) {
    return await prisma.userLevel.update({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      data: {
        voiceTime: {
          increment: seconds,
        },
      },
    });
  }

  static calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100));
  }

  static calculateXPForLevel(level: number): number {
    return level * level * 100;
  }

  // Leaderboard
  static async getLeaderboard(guildId: string, limit: number = 10) {
    return await prisma.userLevel.findMany({
      where: { guildId },
      include: { user: true },
      orderBy: [
        { level: 'desc' },
        { xp: 'desc' },
      ],
      take: limit,
    });
  }

  static async getMonthlyLeaderboard(guildId: string, month: number, year: number, limit: number = 10) {
    return await prisma.monthlyLeaderboard.findMany({
      where: {
        guildId,
        month,
        year,
      },
      orderBy: [
        { xpGained: 'desc' },
      ],
      take: limit,
    });
  }

  // Level Rewards
  static async getLevelRewards(guildId: string) {
    return await prisma.levelReward.findMany({
      where: { guildId },
      orderBy: { level: 'asc' },
    });
  }

  static async addLevelReward(data: {
    guildId: string;
    level: number;
    roleId: string;
    description?: string;
  }) {
    return await prisma.levelReward.create({ data });
  }

  static async removeLevelReward(guildId: string, level: number) {
    return await prisma.levelReward.delete({
      where: {
        guildId_level: {
          guildId,
          level,
        },
      },
    });
  }

  // Quarantine System
  static async addQuarantineEntry(data: {
    guildId: string;
    targetId: string;
    targetType: 'USER' | 'CHANNEL' | 'ROLE';
    moderatorId: string;
    reason: string;
  }) {
    return await prisma.quarantineEntry.create({
      data,
      include: {
        moderator: true,
      },
    });
  }

  static async removeQuarantineEntry(id: number) {
    return await prisma.quarantineEntry.update({
      where: { id },
      data: { active: false },
    });
  }

  static async getActiveQuarantineEntries(guildId: string) {
    return await prisma.quarantineEntry.findMany({
      where: {
        guildId,
        active: true,
      },
      include: {
        moderator: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }                             
}