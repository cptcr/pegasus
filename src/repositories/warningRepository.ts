import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { db } from '../database/drizzle';
import { warnings, warningAutomations } from '../database/schema';
import { nanoid } from 'nanoid';

export interface CreateWarningData {
  guildId: string;
  userId: string;
  moderatorId: string;
  title: string;
  description?: string;
  level?: number;
  proof?: string;
}

export interface UpdateWarningData {
  title?: string;
  description?: string;
  editedBy: string;
}

export interface CreateAutomationData {
  guildId: string;
  name: string;
  description?: string;
  triggerType: 'warn_count' | 'warn_level';
  triggerValue: number;
  actions: any[];
  createdBy: string;
}

export class WarningRepository {
  async createWarning(data: CreateWarningData) {
    const warnId = `W${nanoid(10)}`;
    
    const [warning] = await db.insert(warnings).values({
      warnId,
      guildId: data.guildId,
      userId: data.userId,
      moderatorId: data.moderatorId,
      title: data.title,
      description: data.description,
      level: data.level || 1,
      proof: data.proof,
    }).returning();

    return warning;
  }

  async updateWarning(warnId: string, data: UpdateWarningData) {
    const [updated] = await db.update(warnings)
      .set({
        ...data,
        editedAt: new Date(),
      })
      .where(eq(warnings.warnId, warnId))
      .returning();

    return updated;
  }

  async getWarningById(warnId: string) {
    const [warning] = await db.select()
      .from(warnings)
      .where(eq(warnings.warnId, warnId))
      .limit(1);

    return warning;
  }

  async getUserWarnings(guildId: string, userId: string) {
    return db.select()
      .from(warnings)
      .where(
        and(
          eq(warnings.guildId, guildId),
          eq(warnings.userId, userId),
          eq(warnings.active, true)
        )
      )
      .orderBy(desc(warnings.createdAt));
  }

  async getUserWarningStats(guildId: string, userId: string) {
    const activeWarnings = await db.select({
      count: sql<number>`count(*)::int`,
      totalLevel: sql<number>`COALESCE(sum(${warnings.level}), 0)::int`
    })
    .from(warnings)
    .where(
      and(
        eq(warnings.guildId, guildId),
        eq(warnings.userId, userId),
        eq(warnings.active, true)
      )
    );

    return {
      count: activeWarnings[0]?.count || 0,
      totalLevel: activeWarnings[0]?.totalLevel || 0,
    };
  }

  async createAutomation(data: CreateAutomationData) {
    const automationId = `AUTO${nanoid(8)}`;
    
    const [automation] = await db.insert(warningAutomations).values({
      automationId,
      guildId: data.guildId,
      name: data.name,
      description: data.description,
      triggerType: data.triggerType,
      triggerValue: data.triggerValue,
      actions: data.actions,
      createdBy: data.createdBy,
    }).returning();

    return automation;
  }

  async getGuildAutomations(guildId: string) {
    return db.select()
      .from(warningAutomations)
      .where(eq(warningAutomations.guildId, guildId))
      .orderBy(desc(warningAutomations.createdAt));
  }

  async deleteAutomation(automationId: string) {
    const [deleted] = await db.delete(warningAutomations)
      .where(eq(warningAutomations.automationId, automationId))
      .returning();

    return deleted;
  }

  async getActiveAutomations(guildId: string) {
    return db.select()
      .from(warningAutomations)
      .where(
        and(
          eq(warningAutomations.guildId, guildId),
          eq(warningAutomations.enabled, true)
        )
      );
  }

  async updateAutomationLastTriggered(automationId: string) {
    await db.update(warningAutomations)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(warningAutomations.automationId, automationId));
  }

  async getRecentWarnings(guildId: string, userId: string, hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return db.select()
      .from(warnings)
      .where(
        and(
          eq(warnings.guildId, guildId),
          eq(warnings.userId, userId),
          eq(warnings.active, true),
          gte(warnings.createdAt, since)
        )
      );
  }
}

export const warningRepository = new WarningRepository();