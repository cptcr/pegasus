import { eq } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import { guilds, guildSettings } from '../database/schema';
import type { Guild, GuildSettings } from '../types';

export class GuildRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: string): Promise<Guild | null> {
    const result = await this.db
      .select()
      .from(guilds)
      .where(eq(guilds.id, id))
      .limit(1);
    
    return result[0] || null;
  }

  async create(guildId: string): Promise<Guild> {
    const [guild] = await this.db
      .insert(guilds)
      .values({ id: guildId })
      .returning();
    
    return guild;
  }

  async update(guildId: string, data: Partial<Omit<Guild, 'id' | 'createdAt'>>): Promise<Guild | null> {
    const [updated] = await this.db
      .update(guilds)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(guilds.id, guildId))
      .returning();
    
    return updated || null;
  }

  async delete(guildId: string): Promise<boolean> {
    const result = await this.db
      .delete(guilds)
      .where(eq(guilds.id, guildId));
    
    return result.count > 0;
  }

  async getSettings(guildId: string): Promise<GuildSettings | null> {
    const result = await this.db
      .select()
      .from(guildSettings)
      .where(eq(guildSettings.guildId, guildId))
      .limit(1);
    
    return result[0] || null;
  }

  async updateSettings(guildId: string, settings: Partial<Omit<GuildSettings, 'guildId' | 'createdAt'>>): Promise<GuildSettings> {
    const [updated] = await this.db
      .insert(guildSettings)
      .values({ guildId, ...settings })
      .onConflictDoUpdate({
        target: guildSettings.guildId,
        set: { ...settings, updatedAt: new Date() },
      })
      .returning();
    
    return updated;
  }
}

// Export singleton instance
export const guildRepository = new GuildRepository();