// types/index.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Collection,
  ClientEvents,
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
  guildId: string;
  data: T;
  timestamp: string;
}

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