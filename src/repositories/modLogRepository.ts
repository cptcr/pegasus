import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import { modLogSettings } from '../database/schema';
import type { ModLogCategory, ModLogSetting } from '../types';

function mapModLogSetting(record: typeof modLogSettings.$inferSelect): ModLogSetting {
  return {
    id: record.id,
    guildId: record.guildId,
    category: record.category as ModLogCategory,
    channelId: record.channelId,
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class ModLogRepository {
  private get db() {
    return getDatabase();
  }

  async getByGuild(guildId: string): Promise<ModLogSetting[]> {
    const records = await this.db
      .select()
      .from(modLogSettings)
      .where(eq(modLogSettings.guildId, guildId));

    return records.map(mapModLogSetting);
  }

  async get(guildId: string, category: ModLogCategory): Promise<ModLogSetting | null> {
    const [record] = await this.db
      .select()
      .from(modLogSettings)
      .where(and(eq(modLogSettings.guildId, guildId), eq(modLogSettings.category, category)))
      .limit(1);

    return record ? mapModLogSetting(record) : null;
  }

  async upsert(
    guildId: string,
    category: ModLogCategory,
    channelId: string,
    enabled = true
  ): Promise<ModLogSetting> {
    const [record] = await this.db
      .insert(modLogSettings)
      .values({
        guildId,
        category,
        channelId,
        enabled,
      })
      .onConflictDoUpdate({
        target: [modLogSettings.guildId, modLogSettings.category],
        set: {
          channelId,
          enabled,
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapModLogSetting(record);
  }

  async delete(guildId: string, category: ModLogCategory): Promise<boolean> {
    const [record] = await this.db
      .delete(modLogSettings)
      .where(and(eq(modLogSettings.guildId, guildId), eq(modLogSettings.category, category)))
      .returning();

    return Boolean(record);
  }

  async setEnabled(
    guildId: string,
    category: ModLogCategory,
    enabled: boolean
  ): Promise<ModLogSetting | null> {
    const [record] = await this.db
      .update(modLogSettings)
      .set({
        enabled,
        updatedAt: new Date(),
      })
      .where(and(eq(modLogSettings.guildId, guildId), eq(modLogSettings.category, category)))
      .returning();

    return record ? mapModLogSetting(record) : null;
  }
}

export const modLogRepository = new ModLogRepository();
