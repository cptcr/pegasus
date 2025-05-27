// dashboard/types/index.ts - Fixed and Complete Dashboard Types
import { User as NextAuthUser } from 'next-auth';
import { 
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
  AutomodRule as PrismaAutomodRule, 
  UserLevel as PrismaUserLevel, 
  CustomCommand as PrismaCustomCommand,
  Prisma
} from '@prisma/client';

// ===== SHARED TYPES =====

// Discord Profile (for NextAuth)
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
}

// Guild Member with Roles (for auth)
export interface GuildMemberWithRoles {
  roles: string[];
  nick?: string | null;
  avatar?: string | null;
  joined_at: string;
}

// WebSocket Real-time Event
export interface RealtimeEvent<T = unknown> {
  type: string;
  guildId: string;
  data: T;
  timestamp: string;
}

// ===== GUILD & SETTINGS =====

export interface GuildSettings {
  prefix?: string;
  logChannel?: string | null;
  modLogChannelId?: string | null;
  levelUpChannelId?: string | null;
  quarantineRoleId?: string | null;
  staffRoleId?: string | null;
  welcomeChannel?: string | null;
  geizhalsChannelId?: string | null;
  joinToCreateChannelId?: string | null;
  joinToCreateCategoryId?: string | null;
  enableLeveling?: boolean;
  enableModeration?: boolean;
  enablePolls?: boolean;
  enableGiveaways?: boolean;
  enableTickets?: boolean;
  enableGeizhals?: boolean;
  enableAutomod?: boolean;
  enableMusic?: boolean;
  enableJoinToCreate?: boolean;
  welcomeMessage?: string;
  goodbyeMessage?: string;
}

export interface GuildStats {
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
}

export interface DiscordGuildInfo {
  id: string;
  name: string;
  icon: string | null;
  iconURL?: string | null;
  features: string[];
  memberCount: number;
  onlineCount?: number;
  ownerId?: string;
  description?: string | null;
  createdAt?: Date;
}

export interface GuildWithFullStats extends PrismaGuild {
  settings: GuildSettings;
  stats: GuildStats;
  discord: DiscordGuildInfo;
  members?: (PrismaUser & { warnings?: PrismaWarn[]; userLevels?: PrismaUserLevel[] })[];
  warnings?: PrismaWarn[];
  polls?: (PrismaPoll & { options?: PrismaPollOption[]; votes?: PrismaPollVote[] })[];
  giveaways?: (PrismaGiveaway & { entries?: PrismaGiveawayEntry[] })[];
  tickets?: PrismaTicket[];
  logs?: Prisma.JsonValue[];
  levelRewards?: PrismaLevelReward[];
  autoModRules?: PrismaAutomodRule[];
}

// ===== API TYPES =====

export interface ApiChannel {
  id: string;
  name: string;
  type: number;
  parentId?: string | null;
}

export interface ApiRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

// ===== ACTIVITY & METRICS =====

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

// ===== SPECIFIC EVENT DATA =====

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

// ===== MODERATION =====

export interface ModerationData {
  warnings: PrismaWarn[];
  quarantinedUsers: any[];
  autoModRules: PrismaAutomodRule[];
}
// ===== LEVELING =====

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

// ===== CONSTANTS =====

export const DEFAULT_COOLDOWN = 3;