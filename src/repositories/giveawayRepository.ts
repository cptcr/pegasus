import { eq, and, sql, lt, isNull } from 'drizzle-orm';
import { db } from '../database/drizzle';
import { giveaways, giveawayEntries } from '../database/schema/giveaways';

export interface CreateGiveawayData {
  giveawayId: string;
  guildId: string;
  channelId: string;
  messageId?: string;
  hostedBy: string;
  prize: string;
  winnerCount: number;
  endTime: Date;
  description: string | null;
  requirements: any;
  bonusEntries: any;
  embedColor: number;
}

export class GiveawayRepository {
  async createGiveaway(data: CreateGiveawayData) {
    const [giveaway] = await db.insert(giveaways).values({
      ...data,
      status: 'active',
      entries: 0,
    }).returning();

    return giveaway;
  }

  async getGiveaway(giveawayId: string) {
    const [giveaway] = await db.select()
      .from(giveaways)
      .where(eq(giveaways.giveawayId, giveawayId))
      .limit(1);

    return giveaway;
  }

  async updateGiveaway(giveawayId: string, updates: Partial<typeof giveaways.$inferInsert>) {
    const [updated] = await db.update(giveaways)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(giveaways.giveawayId, giveawayId))
      .returning();

    return updated;
  }

  async addEntry(giveawayId: string, userId: string, entryCount: number) {
    // Check if user already has an entry
    const [existing] = await db.select()
      .from(giveawayEntries)
      .where(
        and(
          eq(giveawayEntries.giveawayId, giveawayId),
          eq(giveawayEntries.userId, userId)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing entry
      await db.update(giveawayEntries)
        .set({
          entries: entryCount,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(giveawayEntries.giveawayId, giveawayId),
            eq(giveawayEntries.userId, userId)
          )
        );
    } else {
      // Create new entry
      await db.insert(giveawayEntries).values({
        giveawayId,
        userId,
        entries: entryCount,
      });

      // Increment entry count on giveaway
      await db.update(giveaways)
        .set({
          entries: sql`${giveaways.entries} + 1`,
        })
        .where(eq(giveaways.giveawayId, giveawayId));
    }
  }

  async removeEntry(giveawayId: string, userId: string) {
    const deleted = await db.delete(giveawayEntries)
      .where(
        and(
          eq(giveawayEntries.giveawayId, giveawayId),
          eq(giveawayEntries.userId, userId)
        )
      )
      .returning();

    if (deleted.length > 0) {
      // Decrement entry count on giveaway
      await db.update(giveaways)
        .set({
          entries: sql`GREATEST(${giveaways.entries} - 1, 0)`,
        })
        .where(eq(giveaways.giveawayId, giveawayId));
    }
  }

  async getEntries(giveawayId: string) {
    return db.select()
      .from(giveawayEntries)
      .where(eq(giveawayEntries.giveawayId, giveawayId));
  }

  async getUserEntry(giveawayId: string, userId: string) {
    const [entry] = await db.select()
      .from(giveawayEntries)
      .where(
        and(
          eq(giveawayEntries.giveawayId, giveawayId),
          eq(giveawayEntries.userId, userId)
        )
      )
      .limit(1);

    return entry;
  }

  async getActiveGiveaways() {
    return db.select()
      .from(giveaways)
      .where(eq(giveaways.status, 'active'));
  }

  async getGuildGiveaways(guildId: string, status?: 'active' | 'ended' | 'cancelled') {
    const conditions = [eq(giveaways.guildId, guildId)];
    
    if (status) {
      conditions.push(eq(giveaways.status, status));
    }

    return db.select()
      .from(giveaways)
      .where(and(...conditions))
      .orderBy(giveaways.createdAt);
  }

  async getExpiredGiveaways() {
    return db.select()
      .from(giveaways)
      .where(
        and(
          eq(giveaways.status, 'active'),
          lt(giveaways.endTime, new Date())
        )
      );
  }

  async getUserGiveawayStats(userId: string) {
    const entries = await db.select({
      totalEntries: sql<number>`count(*)::int`,
      totalWins: sql<number>`count(case when ${giveaways.winners}::jsonb ? ${userId} then 1 end)::int`,
    })
    .from(giveawayEntries)
    .leftJoin(giveaways, eq(giveawayEntries.giveawayId, giveaways.giveawayId))
    .where(eq(giveawayEntries.userId, userId));

    return {
      totalEntries: entries[0]?.totalEntries || 0,
      totalWins: entries[0]?.totalWins || 0,
    };
  }
}

export const giveawayRepository = new GiveawayRepository();