// dashboard/types/index.ts - Complete Types with All Required Exports
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ClientEvents,
  ColorResolvable as DiscordColorResolvable,
  Client,
} from 'discord.js';
import { 
  Prisma, 
  Guild as PrismaGuild, 
  User as PrismaUser, 
  Warn as PrismaWarn, 
  Poll as PrismaPoll, 
  PollOption as PrismaPollOption, 
  PollVote as PrismaPollVote, 
  Giveaway as PrismaGiveaway, 
  GiveawayEntry as PrismaGiveawayEntry, 
  Ticket as PrismaTicket, 
  LevelReward as PrismaLevelReward, 
  AutoModRule as PrismaAutoModRule, 
  UserLevel as PrismaUserLevel, 
  Quarantine as PrismaQuarantine, 
  J2CSettings as PrismaJ2CSettings,
  Log as PrismaLog
} from '@prisma/client';

// Bot & Event Structures
export interface Command {
  data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  category: string;
  cooldown?: number;
  execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<void>;
}

export interface BotEvent<K extends keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (client: Client, ...args: ClientEvents[K]) => Promise<void> | void;
}

// Settings Structures - FIXED: Consistent property naming and JsonValue compatibility
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
  welcomeChannelId?: string | null; // FIXED: Use welcomeChannelId for consistency
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
  // Add index signature to make it compatible with JsonObject
  [key: string]: string | number | boolean | null | undefined;
}

// J2CSettings type from Prisma
export type J2CSettings = PrismaJ2CSettings;
export type J2CSettingsUpdate = Partial<Omit<J2CSettings, 'id' | 'guildId' | 'createdAt' | 'updatedAt'>>;

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

export interface WarnCreateData extends PrismaWarn {
  username?: string;
}

export interface PollCreateData extends PrismaPoll {
  title: string;
}

export interface GiveawayCreateData extends PrismaGiveaway {
  prize: string;
}

export interface TicketCreateData extends PrismaTicket {
  subject: string;
}

export interface MemberJoinLeaveData {
  username?: string;
  userId: string;
}

export interface LevelUpdateData extends PrismaUserLevel {
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

// Extended Guild type with additional properties - EXPORTED
export interface FullGuildData {
  id: string;
  name: string;
  prefix: string;
  settings: Prisma.JsonValue;
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
  // Extended properties
  ownerId?: string;
  description?: string | null;
  members: (PrismaUser & { warnings: PrismaWarn[]; userLevels: PrismaUserLevel[] })[];
  warnings: PrismaWarn[];
  polls: (PrismaPoll & { options: PrismaPollOption[]; votes: PrismaPollVote[] })[];
  giveaways: (PrismaGiveaway & { entries: PrismaGiveawayEntry[] })[];
  tickets: PrismaTicket[];
  logs: PrismaLog[];
  levelRewards: PrismaLevelReward[];
  autoModRules: PrismaAutoModRule[];
}

// Guild with full stats - EXPORTED
export interface GuildWithFullStats {
  // Base Prisma Guild properties
  id: string;
  name: string;
  prefix: string;
  settings: Prisma.JsonValue;
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
  
  // Additional computed stats
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
  
  // Discord API data
  discord: {
    id: string;
    name: string; // Required, not optional
    icon: string | null; // Required, can be null but not undefined
    iconURL?: string | null;
    features: string[]; // Required array, not optional
    memberCount?: number;
    onlineCount?: number;
    ownerId?: string;
    description?: string | null;
    createdAt?: Date;
  };
  
  // Optional relations
  members?: (PrismaUser & { warnings?: PrismaWarn[]; userLevels?: PrismaUserLevel[] })[];
  warnings?: PrismaWarn[];
  polls?: (PrismaPoll & { options?: PrismaPollOption[]; votes?: PrismaPollVote[] })[];
  giveaways?: (PrismaGiveaway & { entries?: PrismaGiveawayEntry[] })[];
  tickets?: PrismaTicket[];
  logs?: PrismaLog[];
  levelRewards?: PrismaLevelReward[];
  autoModRules?: PrismaAutoModRule[];
  userLevels?: PrismaUserLevel[];
}

// For DiscordProfile in [...nextauth].ts - EXPORTED
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
  hasRequiredAccess?: boolean; // FIXED: Add this property
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
  warnings: PrismaWarn[];
  quarantinedUsers: PrismaQuarantine[];
  autoModRules: PrismaAutoModRule[];
}

// For Level API Data
export interface LeaderboardEntry extends PrismaUserLevel {
  user: Pick<PrismaUser, 'id' | 'username'>;
  rank: number;
}

export interface LevelDataResponse {
  leaderboard: LeaderboardEntry[];
  total: number;
  currentPage: number;
  totalPages: number;
  levelRewards: PrismaLevelReward[];
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

// Export specific Prisma types we need
export type { 
  PrismaWarn as Warn,
  PrismaQuarantine as Quarantine,
  PrismaAutoModRule as AutoModRule,
  PrismaLevelReward as LevelReward,
  PrismaUserLevel as UserLevel,
  PrismaUser as User,
  PrismaPoll as Poll,
  PrismaGiveaway as Giveaway,
  PrismaTicket as Ticket,
  PrismaGuild as Guild
};

// Default cooldown for commands if not specified
export const DEFAULT_COOLDOWN: number = 3;