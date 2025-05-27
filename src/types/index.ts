// src/types/index.ts - Complete Types File with All Exports
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ClientEvents,
  ColorResolvable as DiscordColorResolvable,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

// Bot & Event Structures
export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  category: string;
  cooldown?: number;
  execute: (interaction: ChatInputCommandInteraction, client: any) => Promise<void>;
}

export interface BotEvent<K extends keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (client: any, ...args: ClientEvents[K]) => Promise<void> | void;
}

// Define essential types locally to avoid Prisma import issues
export interface Guild {
  id: string;
  name: string;
  settings?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  username: string;
  discriminator?: string | null;
  avatar?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserLevel {
  id: number;
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  messages: number;
  voiceTime: number;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
}

export interface Warn {
  id: number;
  userId: string;
  guildId: string;
  moderatorId: string;
  reason: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Poll {
  id: number;
  guildId: string;
  channelId: string;
  messageId?: string | null;
  title: string;
  description?: string | null;
  creatorId: string;
  multiple: boolean;
  anonymous: boolean;
  active: boolean;
  endTime?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  options: PollOption[];
  votes: PollVote[];
}

export interface PollOption {
  id: number;
  pollId: number;
  text: string;
  emoji?: string | null;
  orderIndex: number;
}

export interface PollVote {
  id: number;
  pollId: number;
  optionId: number;
  userId: string;
}

export interface Giveaway {
  id: number;
  guildId: string;
  channelId: string;
  messageId?: string | null;
  title: string;
  description?: string | null;
  prize: string;
  winners: number;
  creatorId: string;
  endTime: Date;
  active: boolean;
  ended: boolean;
  winnerUserIds: string[];
  requiredRole?: string | null;
  requiredLevel?: number | null;
  createdAt: Date;
  updatedAt: Date;
  entries: GiveawayEntry[];
}

export interface GiveawayEntry {
  id: number;
  giveawayId: number;
  userId: string;
}

export interface Ticket {
  id: number;
  guildId: string;
  userId: string;
  channelId: string;
  status: TicketStatus;
  category: string;
  subject: string;
  priority: TicketPriority;
  moderatorId?: string | null;
  closedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING',
  CLOSED = 'CLOSED'
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface Quarantine {
  id: number;
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  active: boolean;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LevelReward {
  id: number;
  guildId: string;
  level: number;
  roleId: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoModRule {
  id: number;
  guildId: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  triggerMetadata: any;
  actions: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomCommand {
  id: number;
  guildId: string;
  name: string;
  description: string;
  response: string;
  enabled: boolean;
  creatorId: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Log {
  id: number;
  guildId: string;
  type: string;
  content: any;
  userId?: string | null;
  createdAt: Date;
}

export interface J2CSettings {
  id: number;
  guildId: string;
  isEnabled: boolean;
  categoryId: string;
  joinChannelId: string;
  channelNameTemplate: string;
  defaultUserLimit: number;
  defaultBitrate: number;
  allowTextChannel: boolean;
  autoDeleteEmpty: boolean;
  lockEmptyChannels: boolean;
  blacklistUserIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Settings Structures
export interface GuildSettings {
  prefix?: string | null;
  modLogChannelId?: string | null;
  quarantineRoleId?: string | null;
  staffRoleId?: string | null;
  enableLeveling?: boolean;
  enableModeration?: boolean;
  enablePolls?: boolean;
  enableGiveaways?: boolean;
  enableTickets?: boolean;
  enableQuarantine?: boolean;
  enableWelcome?: boolean;
  welcomeChannelId?: string | null;
  autorole?: string | null;
  welcomeMessage?: string | null;
  goodbyeMessage?: string | null;
  enableGeizhals?: boolean;
  geizhalsChannelId?: string | null;
  levelUpChannelId?: string | null;
  enableAutomod?: boolean;
  enableMusic?: boolean;
  enableJoinToCreate?: boolean;
  joinToCreateChannelId?: string | null;
  joinToCreateCategoryId?: string | null;
  [key: string]: string | number | boolean | null | undefined;
}

// WebSocket Event Structure for communication between bot and dashboard
export interface RealtimeEvent<T = unknown> {
  type: string;
  guildId: string;
  data: T;
  timestamp: string;
}

// Specific event data types for WebSocket
export interface GuildStatsUpdateData {
  memberCount?: number;
  onlineCount?: number;
}

export interface WarnCreateData extends Warn {
  username?: string;
}

export interface PollCreateData extends Poll {
  title: string;
}

export interface GiveawayCreateData extends Giveaway {
  prize: string;
}

export interface TicketCreateData extends Ticket {
  subject: string;
}

export interface MemberJoinLeaveData {
  username?: string;
  userId: string;
}

export interface LevelUpdateData extends UserLevel {
   username?: string;
}

// API Structures for Dashboard
export interface ApiRole {
  id: string;
  name: string;
  color: number;
  managed: boolean;
  position: number;
}

export interface ApiChannel {
  id: string;
  name: string;
  type: number;
  parentId?: string | null;
}

// Extended Guild type with additional properties
export interface FullGuildData {
  id: string;
  name: string;
  prefix: string;
  settings: any;
  enableLeveling: boolean;
  enableModeration: boolean;
  enableGeizhals: boolean;
  enablePolls: boolean;
  enableGiveaways: boolean;
  enableAutomod: boolean;
  enableTickets: boolean;
  enableMusic: boolean;
  enableJoinToCreate: boolean;
  createdAt: Date;
  updatedAt: Date;
  ownerId?: string;
  description?: string | null;
  members: (User & { warnings: Warn[]; userLevels: UserLevel[] })[];
  warnings: Warn[];
  polls: (Poll & { options: PollOption[]; votes: PollVote[] })[];
  giveaways: (Giveaway & { entries: GiveawayEntry[] })[];
  tickets: Ticket[];
  logs: Log[];
  levelRewards: LevelReward[];
  autoModRules: AutoModRule[];
}

// Guild with full stats
export interface GuildWithFullStats {
  id: string;
  name: string;
  prefix: string;
  settings: any;
  enableLeveling: boolean;
  enableModeration: boolean;
  enableGeizhals: boolean;
  enablePolls: boolean;
  enableGiveaways: boolean;
  enableAutomod: boolean;
  enableTickets: boolean;
  enableMusic: boolean;
  enableJoinToCreate: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  stats: {
    memberCount: number;
    onlineCount: number;
    ticketCount: number;
    pollCount: number;
    giveawayCount: number;
    warningCount: number;
    totalUsers: number;
    activeQuarantine: number;
    totalTrackers: number;
    activePolls: number;
    activeGiveaways: number;
    openTickets: number;
    customCommands: number;
    levelRewards: number;
    automodRules: number;
    levelingEnabled: boolean;
    moderationEnabled: boolean;
    geizhalsEnabled: boolean;
    enableAutomod: boolean;
    enableMusic: boolean;
    enableJoinToCreate: boolean;
    engagementRate: number;
    moderationRate: number;
    lastUpdated: string;
  };
  
  discord: {
    id: string;
    name: string;
    icon: string | null;
    iconURL?: string | null;
    features: string[];
    memberCount?: number;
    onlineCount?: number;
    ownerId?: string;
    description?: string | null;
    createdAt?: Date;
  };
  
  members?: (User & { warnings?: Warn[]; userLevels?: UserLevel[] })[];
  warnings?: Warn[];
  polls?: (Poll & { options?: PollOption[]; votes?: PollVote[] })[];
  giveaways?: (Giveaway & { entries?: GiveawayEntry[] })[];
  tickets?: Ticket[];
  logs?: Log[];
  levelRewards?: LevelReward[];
  autoModRules?: AutoModRule[];
  userLevels?: UserLevel[];
}

// For DiscordProfile in [...nextauth].ts
export interface DiscordProfile {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string | null;
  banner?: string | null;
  accent_color?: number | null;
  flags?: number;
  locale?: string;
  mfa_enabled?: boolean;
  premium_type?: number;
  public_flags?: number;
  image_url?: string;
  hasRequiredAccess?: boolean;
  targetGuild?: { id: string; name: string; icon: string | null; } | null;
}

// Extended User interface for NextAuth sessions
export interface ExtendedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  username?: string;
  discriminator?: string;
  avatar?: string | null;
  hasRequiredAccess?: boolean;
}

// For Dashboard Activity API
export interface ActivityMetrics {
  activityScore: number;
  healthScore: number;
  totalEvents: number;
  averageDaily: {
    warns: number;
    polls: number;
    giveaways: number;
    tickets: number;
  };
}

export interface RecentActivityData {
  recentWarns: number;
  recentPolls: number;
  recentGiveaways: number;
  recentTickets: number;
  today: {
    warns: number;
    polls: number;
    giveaways: number;
    tickets: number;
  };
  trends: {
    warns: number;
    polls: number;
    giveaways: number;
    tickets: number;
  };
  weeklyComparison: {
    thisWeek: { warns: number; polls: number; giveaways: number; tickets: number };
    lastWeek: { warns: number; polls: number; giveaways: number; tickets: number };
    trends: { warns: number; polls: number; giveaways: number; tickets: number };
  };
  metrics: ActivityMetrics;
  period: string;
  lastUpdated: string;
  dataSource: string;
}

// For Moderation API Data
export interface ModerationData {
  warnings: Warn[];
  quarantinedUsers: Quarantine[];
  autoModRules: AutoModRule[];
}

// For Level API Data
export interface LeaderboardEntry extends Omit<UserLevel, 'user'> {
  user: Pick<User, 'id' | 'username'>;
  rank: number;
}

export interface LevelDataResponse {
  leaderboard: LeaderboardEntry[];
  total: number;
  currentPage: number;
  totalPages: number;
  levelRewards: LevelReward[];
}

// Additional interfaces
export interface GuildMemberWithRoles {
  roles: string[];
  nick?: string | null;
  avatar?: string | null;
  joined_at: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

// Shared color type from Discord.js
export type { DiscordColorResolvable as ColorResolvable };

// Default cooldown for commands if not specified
export const DEFAULT_COOLDOWN: number = 3;