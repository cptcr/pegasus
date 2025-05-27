// types/index.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Collection,
  ClientEvents,
<<<<<<< HEAD
=======
  ColorResolvable as DiscordColorResolvable, // Renaming to avoid conflict if needed
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
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

<<<<<<< HEAD
// Settings & Configuration Types
// Using Prisma.JsonObject for flexible settings, but specific known fields are typed
export interface GuildSettings {
  prefix: string;
  modLogChannelId?: string | null;
  quarantineRoleId?: string | null;
  staffRoleId?: string | null;
  welcomeChannelId?: string | null;
  leaveChannelId?: string | null;
  levelUpChannelId?: string | null;
  geizhalsChannelId?: string | null;
  joinToCreateSettings?: J2CSettings | null;
  enableLeveling: boolean;
  enableModeration: boolean;
  enablePolls: boolean;
  enableGiveaways: boolean;
  enableTickets: boolean;
  enableGeizhals: boolean;
  enableAutomod: boolean;
  enableMusic: boolean;
  enableJoinToCreate: boolean;
}

export type J2CSettings = PrismaJ2CSettings;
export type J2CSettingsUpdate = Partial<Omit<J2CSettings, 'guildId' | 'createdAt' | 'updatedAt'>>;

// WebSocket Event Structure for communication between bot and dashboard
export interface RealtimeEvent<T = any> {
  type: string;
=======
// Settings Structures
// Using Prisma.JsonObject for flexible settings, but specific known fields are typed
export interface GuildSettings extends Prisma.JsonObject {
  name?: string | null;
  prefix?: string | null;
  logChannel?: string | null;
  modLogChannel?: string | null;
  quarantineRoleId?: string | null;
  staffRoleId?: string | null; // Added for ticket staff permissions
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
  type: string; // e.g., 'guild:updated', 'warn:created'
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
  guildId: string;
  data: T;
  timestamp: string;
}

<<<<<<< HEAD
// API Types
export interface ApiChannel {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
}

export interface ApiRole {
  id: string;
  name: string;
  color: number;
  managed: boolean;
  position: number;
}

=======
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
// Specific event data types for WebSocket
export interface GuildStatsUpdateData {
  memberCount?: number;
  onlineCount?: number;
  // other stats can be added here
}

export interface WarnCreateData extends PrismaWarn {
  username?: string; // if available from context
}
export interface PollCreateData extends PrismaPoll {
  title: string; // ensure title is present
}
export interface GiveawayCreateData extends PrismaGiveaway {
  prize: string; // ensure prize is present
}
export interface TicketCreateData extends PrismaTicket {
  subject: string; // ensure subject is present
}
export interface MemberJoinLeaveData {
  username?: string;
  userId: string;
}
export interface LevelUpdateData extends PrismaUserLevel {
   username?: string;
}

<<<<<<< HEAD
// Moderation Structures
export interface WarnData extends PrismaWarn {
  username?: string;
  actionType?: string;
  reason?: string;
  moderator?: string;
}

// Welcome/Leave Settings
export interface WelcomeSettings {
  enabled: boolean;
  channelId: string | null;
  message: string | null;
  imageEnabled: boolean;
  imageUrl: string | null;
  roleId: string | null;
  dmMessage: string | null;
}

export interface LeaveSettings {
  enabled: boolean;
  channelId: string | null;
  message: string | null;
}

// Geizhals Tracker Structures
export interface GeizhalsProduct {
  id: number;
  guildId: string;
  url: string;
  name: string;
  currentPrice: number;
  lastPrice: number;
  lowestPrice: number;
  highestPrice: number;
  channelId: string;
  threshold: number;
  lastChecked: Date;
  enabled: boolean;
}

// Join2Create Structures
export interface J2CChannel {
  id: string;
  ownerId: string;
  parentId: string;
  createdAt: Date;
  settings: J2CSettings;
}

// ModLog Types
export type ModAction = 
  | 'BAN'
  | 'UNBAN'
  | 'KICK'
  | 'WARN'
  | 'MUTE'
  | 'UNMUTE'
  | 'QUARANTINE'
  | 'UNQUARANTINE';

export interface ModLogEntry {
  type: ModAction;
  targetId: string;
  moderatorId: string;
  reason?: string;
  duration?: number;
  createdAt: Date;
}

// Export all Prisma types
export * from '@prisma/client';
=======

// API Structures for Dashboard
export interface ApiRole {
  id: string;
  name: string;
  color: number;
  managed: boolean;
  position: number; // Added for sorting
}

export interface ApiChannel {
  id: string;
  name: string;
  type: number; // See discord-api-types/v10 ChannelType
  parentId?: string | null; // Added for categorization
}

export type GuildWithFullStats = PrismaGuild & {
  stats: {
    memberCount: number;
    onlineCount: number;
    ticketCount: number;
    pollCount: number;
    giveawayCount: number;
    warningCount: number;
    totalUsers: number; // From UserLevel
    activeQuarantine: number;
    totalTrackers: number; // From Geizhals
    activePolls: number;
    activeGiveaways: number;
    openTickets: number;
    customCommands: number;
    levelRewards: number;
    automodRules: number;
    levelingEnabled: boolean;
    moderationEnabled: boolean;
    geizhalsEnabled: boolean;
    // enablePolls: boolean; // Already on PrismaGuild if synced
    // enableGiveaways: boolean; // Already on PrismaGuild if synced
    // enableTickets: boolean; // Already on PrismaGuild if synced
    enableAutomod: boolean;
    enableMusic: boolean;
    enableJoinToCreate: boolean;
    engagementRate: number;
    moderationRate: number;
    lastUpdated: string;
  };
  discord: { // Information fetched directly from Discord API
    id: string;
    name: string;
    icon: string | null;
    iconURL?: string | null; // Added for convenience
    features: string[];
    memberCount?: number; // Renamed from approximate_member_count for clarity
    onlineCount?: number; // Renamed from approximate_presence_count for clarity
    ownerId?: string;
    description?: string | null;
    createdAt?: Date;
  };
  // Include Prisma relations if they are part of the "full stats"
  members?: (PrismaUser & { warnings?: PrismaWarn[], userLevels?: PrismaUserLevel[] })[];
  warnings?: PrismaWarn[];
  polls?: (PrismaPoll & { options?: PrismaPollOption[], votes?: PrismaVoteData[] })[];
  giveaways?: (PrismaGiveaway & { entries?: PrismaGiveawayEntry[] })[];
  tickets?: PrismaTicket[];
  logs?: Prisma.JsonValue[]; // Assuming logs can be generic JSON for now
  levelRewards?: PrismaLevelReward[];
  autoModRules?: PrismaAutoModRule[];
  userLevels?: PrismaUserLevel[]; // For member count fallback if needed
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
  image_url?: string; // Often provided by providers
  // guilds: APIUserGuild[]; // From 'discord-api-types/v10'
  hasRequiredAccess?: boolean;
  targetGuild?: { id: string; name: string; icon: string | null; } | null; // Example structure
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
    warns: number; // Renamed for consistency
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
  user: Pick<PrismaUser, 'id' | 'username'>; // Only include necessary fields
  rank: number; // Assuming rank is calculated and added
}
export interface LevelDataResponse {
  leaderboard: LeaderboardEntry[];
  total: number;
  currentPage: number;
  totalPages: number;
  levelRewards: PrismaLevelReward[];
}

// Shared color type from Discord.js
export { DiscordColorResolvable as ColorResolvable };

// Default cooldown for commands if not specified
export const DEFAULT_COOLDOWN = 3; // seconds
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
