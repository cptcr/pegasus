import {
  wordFilterRepository,
  type CreateWordFilterRuleData,
  type UpdateWordFilterRuleData,
} from '../repositories/wordFilterRepository';
import {
  type WordFilterActionConfig,
  type WordFilterRule,
  type WordFilterSeverity,
} from '../types';
import { logger } from '../utils/logger';

const CACHE_TTL_MS = 60 * 1000;

export interface WordFilterViolation {
  rule: WordFilterRule;
  matches: string[];
}

interface CachedRules {
  fetchedAt: number;
  rules: WordFilterRule[];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class WordFilterService {
  private cache = new Map<string, CachedRules>();

  async listRules(guildId: string): Promise<WordFilterRule[]> {
    const cached = this.cache.get(guildId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.rules;
    }

    const rules = await wordFilterRepository.list(guildId);
    this.cache.set(guildId, { fetchedAt: Date.now(), rules });
    return rules;
  }

  async getRule(guildId: string, ruleId: number): Promise<WordFilterRule | null> {
    return wordFilterRepository.getById(guildId, ruleId);
  }

  async createRule(data: CreateWordFilterRuleData): Promise<WordFilterRule> {
    const rule = await wordFilterRepository.create(data);
    this.invalidateCache(data.guildId);
    return rule;
  }

  async updateRule(
    guildId: string,
    ruleId: number,
    data: UpdateWordFilterRuleData
  ): Promise<WordFilterRule | null> {
    const rule = await wordFilterRepository.update(guildId, ruleId, data);
    this.invalidateCache(guildId);
    return rule;
  }

  async deleteRule(guildId: string, ruleId: number): Promise<boolean> {
    const removed = await wordFilterRepository.delete(guildId, ruleId);
    this.invalidateCache(guildId);
    return removed;
  }

  async findViolations(guildId: string, content: string): Promise<WordFilterViolation[]> {
    const rules = await this.listRules(guildId);
    const violations: WordFilterViolation[] = [];

    for (const rule of rules) {
      const regex = this.buildMatcher(rule);
      if (!regex) continue;

      const matches = this.extractMatches(content, regex);

      if (matches.length > 0) {
        violations.push({ rule, matches });
      }
    }

    return violations;
  }

  inferDefaultActions(severity: WordFilterSeverity): WordFilterActionConfig[] {
    switch (severity) {
      case 'low':
        return [{ type: 'warn' }];
      case 'medium':
        return [{ type: 'warn' }, { type: 'timeout', durationSeconds: 600 }];
      case 'high':
        return [{ type: 'timeout', durationSeconds: 1800 }, { type: 'kick' }];
      case 'critical':
        return [{ type: 'timeout', durationSeconds: 3600 }, { type: 'ban' }];
      default:
        return [{ type: 'warn' }];
    }
  }

  invalidateCache(guildId: string): void {
    this.cache.delete(guildId);
  }

  private buildMatcher(rule: WordFilterRule): RegExp | null {
    const flags = rule.caseSensitive ? 'g' : 'gi';

    try {
      if (rule.matchType === 'regex') {
        return new RegExp(rule.pattern, flags);
      }

      const escaped = escapeRegExp(rule.pattern);
      const source = rule.wholeWord ? `\\b${escaped}\\b` : escaped;
      return new RegExp(source, flags);
    } catch (error) {
      logger.warn(
        `Failed to build word filter matcher for guild ${rule.guildId} rule ${rule.id}:`,
        error
      );
      return null;
    }
  }

  private extractMatches(content: string, regex: RegExp): string[] {
    const matches = [];
    let result: RegExpExecArray | null;
    const global = regex.global;
    const clone = global ? regex : new RegExp(regex.source, regex.flags + 'g');

    // Reset lastIndex to ensure fresh search
    clone.lastIndex = 0;

    while ((result = clone.exec(content)) !== null) {
      matches.push(result[0]);
      if (!global) {
        break;
      }
    }

    return matches;
  }
}

export const wordFilterService = new WordFilterService();
