// dashboard/types/index.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Collection,
  ClientEvents,
  ColorResolvable as DiscordColorResolvable,
} from 'discord.js';
import { ExtendedClient } from '@/index';
import { J2CSettings as PrismaJ2CSettings, Prisma, Guild as PrismaGuild, User as PrismaUser, Warn as PrismaWarn, Poll as PrismaPoll, PollOption as PrismaPollOption, PollVote as PrismaPollVote, Giveaway as PrismaGiveaway, GiveawayEntry as PrismaGiveawayEntry, Ticket as PrismaTicket, TicketCategory as PrismaTicketCategory, LevelReward as PrismaLevelReward, AutoModRule as PrismaAutoModRule, UserLevel as PrismaUserLevel, QuarantineEntry as PrismaQuarantineEntry, CustomCommand as PrismaCustomCommand } from '@prisma/client';

// Bot & Event Structures
export interface Command {
  data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  category: string;
  cooldown?: number;
  execute: (interaction: ChatInputCommandInteraction, client: ExtendedClient) => Promise<void>;
}

export interface BotEvent<K extends keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (client: ExtendedClient, ...args: ClientEvents[K]) => Promise<void> | void;
}

// Settings Structures
export interface GuildSettings extends Prisma.JsonObject {
  name?: string | null;
  prefix?: string | null;
  logChannel?: string | null;
  modLogChannel?: string | null;
  quarantineRoleId?: string | null;
  staffRoleId?: string | null;
  enableLeveling?: boolean | null;
  enableModeration?: boolean | null;
  enablePolls?: boolean | null;
  enableGiveaways?: boolean | null;
  enableTickets?: boolean | null;
  enableQuarantine?: boolean | null;
  enableWelcome?: boolean | null;
  welcomeChannel?: string | null;
  autorole?: string | null;
  welcomeMessage?: string | null;
  goodbyeMessage?: string | null;
  enableGeizhals?: boolean | null;
  geizhalsChannelId?: string | null;
  levelUpChannelId?: string | null;
  enableAutomod?: boolean | null;
  enableMusic?: boolean | null;
  enableJoinToCreate?: boolean | null;
  joinToCreateChannelId?: string | null;
  joinToCreateCategoryId?: string | null;
}

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

export type GuildWithFullStats = PrismaGuild & {
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
  members?: (PrismaUser & { warnings?: PrismaWarn[], userLevels?: PrismaUserLevel[] })[];
  warnings?: PrismaWarn[];
  polls?: (PrismaPoll & { options?: PrismaPollOption[], votes?: PrismaPollVote[] })[];
  giveaways?: (PrismaGiveaway & { entries?: PrismaGiveawayEntry[] })[];
  tickets?: PrismaTicket[];
  logs?: Prisma.JsonValue[];
  levelRewards?: PrismaLevelReward[];
  autoModRules?: PrismaAutoModRule[];
  userLevels?: PrismaUserLevel[];
};

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
  quarantinedUsers: PrismaQuarantineEntry[];
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

// Default cooldown for commands if not specified
export const DEFAULT_COOLDOWN = 3;