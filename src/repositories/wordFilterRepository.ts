import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import { wordFilterRules } from '../database/schema';
import type {
  WordFilterRule,
  WordFilterActionConfig,
  WordFilterMatchType,
  WordFilterSeverity,
} from '../types';

function parseActions(actions: unknown): WordFilterActionConfig[] {
  if (!actions) {
    return [];
  }

  if (Array.isArray(actions)) {
    const parsed: WordFilterActionConfig[] = [];

    for (const action of actions) {
      if (!action || typeof action !== 'object') continue;
      const typed = action as {
        type?: string;
        durationSeconds?: number;
        reason?: string;
      };

      if (!typed.type) continue;

      const clean: WordFilterActionConfig = {
        type: typed.type as WordFilterActionConfig['type'],
      };

      if (typeof typed.durationSeconds === 'number') {
        clean.durationSeconds = typed.durationSeconds;
      }

      if (typeof typed.reason === 'string') {
        clean.reason = typed.reason;
      }

      parsed.push(clean);
    }

    return parsed;
  }

  if (typeof actions === 'string') {
    try {
      return parseActions(JSON.parse(actions));
    } catch {
      return [];
    }
  }

  return [];
}

function mapRule(record: typeof wordFilterRules.$inferSelect): WordFilterRule {
  return {
    id: record.id,
    guildId: record.guildId,
    pattern: record.pattern,
    matchType: record.matchType as WordFilterMatchType,
    caseSensitive: record.caseSensitive,
    wholeWord: record.wholeWord,
    severity: record.severity as WordFilterSeverity,
    autoDelete: record.autoDelete,
    notifyChannelId: record.notifyChannelId ?? undefined,
    actions: parseActions(record.actions),
    createdBy: record.createdBy ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export interface CreateWordFilterRuleData {
  guildId: string;
  pattern: string;
  matchType?: WordFilterMatchType;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  severity?: WordFilterSeverity;
  autoDelete?: boolean;
  notifyChannelId?: string;
  actions?: WordFilterActionConfig[];
  createdBy?: string;
}

export interface UpdateWordFilterRuleData {
  pattern?: string;
  matchType?: WordFilterMatchType;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  severity?: WordFilterSeverity;
  autoDelete?: boolean;
  notifyChannelId?: string | null;
  actions?: WordFilterActionConfig[];
}

export class WordFilterRepository {
  private get db() {
    return getDatabase();
  }

  async list(guildId: string): Promise<WordFilterRule[]> {
    const records = await this.db
      .select()
      .from(wordFilterRules)
      .where(eq(wordFilterRules.guildId, guildId));

    return records.map(mapRule);
  }

  async getById(guildId: string, ruleId: number): Promise<WordFilterRule | null> {
    const [record] = await this.db
      .select()
      .from(wordFilterRules)
      .where(and(eq(wordFilterRules.guildId, guildId), eq(wordFilterRules.id, ruleId)))
      .limit(1);

    return record ? mapRule(record) : null;
  }

  async create(data: CreateWordFilterRuleData): Promise<WordFilterRule> {
    const [record] = await this.db
      .insert(wordFilterRules)
      .values({
        guildId: data.guildId,
        pattern: data.pattern,
        matchType: data.matchType ?? 'literal',
        caseSensitive: data.caseSensitive ?? false,
        wholeWord: data.wholeWord ?? true,
        severity: data.severity ?? 'medium',
        autoDelete: data.autoDelete ?? true,
        notifyChannelId: data.notifyChannelId,
        actions: data.actions ?? [],
        createdBy: data.createdBy,
      })
      .returning();

    return mapRule(record);
  }

  async update(
    guildId: string,
    ruleId: number,
    data: UpdateWordFilterRuleData
  ): Promise<WordFilterRule | null> {
    const updatePayload: Partial<typeof wordFilterRules.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.pattern !== undefined) updatePayload.pattern = data.pattern;
    if (data.matchType !== undefined) updatePayload.matchType = data.matchType;
    if (data.caseSensitive !== undefined) updatePayload.caseSensitive = data.caseSensitive;
    if (data.wholeWord !== undefined) updatePayload.wholeWord = data.wholeWord;
    if (data.severity !== undefined) updatePayload.severity = data.severity;
    if (data.autoDelete !== undefined) updatePayload.autoDelete = data.autoDelete;
    if (data.notifyChannelId !== undefined) updatePayload.notifyChannelId = data.notifyChannelId;
    if (data.actions !== undefined) updatePayload.actions = data.actions;

    const [record] = await this.db
      .update(wordFilterRules)
      .set(updatePayload)
      .where(and(eq(wordFilterRules.guildId, guildId), eq(wordFilterRules.id, ruleId)))
      .returning();

    return record ? mapRule(record) : null;
  }

  async delete(guildId: string, ruleId: number): Promise<boolean> {
    const [record] = await this.db
      .delete(wordFilterRules)
      .where(and(eq(wordFilterRules.guildId, guildId), eq(wordFilterRules.id, ruleId)))
      .returning();

    return Boolean(record);
  }
}

export const wordFilterRepository = new WordFilterRepository();
