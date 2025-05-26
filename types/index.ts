// types/index.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Collection,
  ClientEvents,
} from 'discord.js';
import { ExtendedClient } from '@/index';
import { J2CSettings as PrismaJ2CSettings, Prisma, Guild } from '@prisma/client';

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
  logChannel?: string | null;
  modLogChannel?: string | null;
  quarantineRole?: string | null;
  enableLeveling?: boolean;
  enableWelcome?: boolean;
  welcomeChannel?: string | null;
  autorole?: string | null;
  welcomeMessage?: string;
  goodbyeMessage?: string;
}

export type J2CSettings = PrismaJ2CSettings;
export type J2CSettingsUpdate = Partial<Omit<J2CSettings, 'id' | 'guildId' | 'createdAt' | 'updatedAt'>>;

// WebSocket Event Structure
export interface RealtimeEvent<T = unknown> {
  type: string;
  guildId: string;
  data: T;
  timestamp: string;
}

// API Structures
export interface ApiRole {
  id: string;
  name: string;
  color: number;
  managed: boolean;
}

export interface ApiChannel {
  id: string;
  name: string;
  type: number; // See discord-api-types/v10 ChannelType
}

export type GuildWithFullStats = Guild & {
  stats: {
    memberCount: number;
    onlineCount: number;
    ticketCount: number;
    pollCount: number;
    giveawayCount: number;
    warningCount: number;
  };
  discord: {
    id: string;
    name: string;
    icon: string | null;
    features: string[];
    approximate_member_count?: number;
    approximate_presence_count?: number;
  };
};