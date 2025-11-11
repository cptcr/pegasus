export * from './command';

// Database types
export interface Guild {
  id: string;
  prefix?: string;
  language?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  globalName?: string;
  username: string;
  discriminator: string;
  avatar?: string;
  bot: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Member {
  userId: string;
  guildId: string;
  nickname?: string;
  joinedAt: Date;
  xp: number;
  level: number;
  messages: number;
  voiceMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuildSettings {
  guildId: string;
  welcomeEnabled: boolean;
  welcomeChannel?: string;
  welcomeMessage?: string;
  goodbyeEnabled: boolean;
  goodbyeChannel?: string;
  goodbyeMessage?: string;
  logsEnabled: boolean;
  logsChannel?: string;
  xpEnabled: boolean;
  xpRate: number;
  levelUpMessage?: string;
  levelUpChannel?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ModLogCategory = 'message' | 'member' | 'moderation' | 'wordFilter';

export interface ModLogSetting {
  id: number;
  guildId: string;
  category: ModLogCategory;
  channelId: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type WordFilterMatchType = 'literal' | 'regex';
export type WordFilterSeverity = 'low' | 'medium' | 'high' | 'critical';
export type WordFilterActionType = 'warn' | 'timeout' | 'kick' | 'ban' | 'delete' | 'note';

export interface WordFilterActionConfig {
  type: WordFilterActionType;
  durationSeconds?: number;
  reason?: string;
}

export interface WordFilterRule {
  id: number;
  guildId: string;
  pattern: string;
  matchType: WordFilterMatchType;
  caseSensitive: boolean;
  wholeWord: boolean;
  severity: WordFilterSeverity;
  autoDelete: boolean;
  notifyChannelId?: string;
  actions: WordFilterActionConfig[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModCase {
  id: number;
  guildId: string;
  userId: string;
  moderatorId: string;
  type: ModActionType;
  reason?: string;
  duration?: number;
  expiresAt?: Date;
  createdAt: Date;
}

export enum ModActionType {
  Warn = 'warn',
  Mute = 'mute',
  Kick = 'kick',
  Ban = 'ban',
  Unmute = 'unmute',
  Unban = 'unban',
  Timeout = 'timeout',
  Lock = 'lock',
  Unlock = 'unlock',
  Slowmode = 'slowmode',
  Purge = 'purge',
}

export interface Giveaway {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  hostId: string;
  prize: string;
  description?: string;
  winnerCount: number;
  endTime: Date;
  ended: boolean;
  winners?: string[];
  participants: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  id: string;
  guildId: string;
  channelId: string;
  userId: string;
  category: string;
  status: TicketStatus;
  claimedBy?: string;
  closedBy?: string;
  closedAt?: Date;
  transcript?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TicketStatus {
  Open = 'open',
  Claimed = 'claimed',
  Closed = 'closed',
}
