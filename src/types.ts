// src/types.ts
import {
  Collection,
  Message,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder, // Added
  ChatInputCommandInteraction,
  Client as DiscordClient,
  ClientEvents,
  PresenceUpdateStatus,
  ActivityType,
  Guild,
  TextChannel,
  Role
} from 'discord.js';
import { PrismaClient } from '@prisma/client';

export interface PollData {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string;
  title: string;
  creatorId: string;
  multiple: boolean;
  anonymous: boolean;
  active: boolean;
  endsAt?: Date | null;
  options: { id: number; text: string; emoji?: string | null; votesCount?: number }[];
  votes?: Map<string, string[]>; // Temporär für aktive Umfragen, key = option.text, value = userId[]
  totalVotes?: number;
}

export interface BotConfig {
  devGuilds: string[];
  devUsers: string[];
  devRoles: string[];
  defaultPrefix: string;
  enabledFeatures: {
    leveling: boolean;
    moderation: boolean;
    automod: boolean; // Ensure automod is here
    geizhals: boolean;
    polls: boolean;
    giveaways: boolean;
    tickets: boolean;
    music: boolean;
    joinToCreate: boolean;
  };
  debug: boolean;
}

export interface ClientWithCommands extends DiscordClient {
  commands: Collection<string, PrefixCommand>;
  slashCommands: Collection<string, SlashCommand>;
  cooldowns: Collection<string, Collection<string, number>>;
  config: BotConfig;
  prisma: PrismaClient;
  io?: any;
}

// For commands that might have subcommands
export interface SlashCommand {
  data: SlashCommandBuilder; // Now expects a full builder, can have subcommands
  execute: (interaction: ChatInputCommandInteraction, client: ClientWithCommands) => Promise<void>;
  // Optional: A way to map subcommand names to their specific execute functions
  subcommands?: Collection<string, (interaction: ChatInputCommandInteraction, client: ClientWithCommands) => Promise<void>>;
  cooldown?: number;
  category?: string;
  devOnly?: boolean;
  testOnly?: boolean;
  enabled?: boolean;
  permissions?: string[];
  botPermissions?: string[];
}

export interface PrefixCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  execute: (message: Message, args: string[], client: ClientWithCommands) => Promise<void>;
  cooldown?: number;
  category?: string;
  devOnly?: boolean;
  enabled?: boolean;
  permissions?: string[];
  botPermissions?: string[];
}

export interface Feature {
  name: string;
  description?: string;
  initialize: (client: ClientWithCommands) => Promise<void>;
  shutdown?: (client: ClientWithCommands) => Promise<void>;
  enabled?: boolean;
}

export interface Event<K extends keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (client: ClientWithCommands, ...args: ClientEvents[K]) => Promise<void>;
}

export interface CooldownConfig {
  userId: string;
  commandName: string;
  timestamp: number;
  cooldownAmount: number;
}

export interface GuildSettings {
  geizhalsLocation: string;
  id: string;
  name: string; // Added name to GuildSettings for consistency
  prefix: string;
  modLogChannelId?: string | null;
  levelUpChannelId?: string | null;
  welcomeChannelId?: string | null;
  geizhalsChannelId?: string | null;
  joinToCreateChannelId?: string | null;
  joinToCreateCategoryId?: string | null;
  ticketCategoryId?: string | null; // Added for ticket system
  ticketSupportRoleId?: string | null; // Added for ticket system
  enableLeveling: boolean;
  enableModeration: boolean;
  enableGeizhals: boolean;
  enablePolls: boolean;
  enableGiveaways: boolean;
  enableAutomod: boolean;
  enableTickets: boolean;
  enableMusic: boolean;
  enableJoinToCreate: boolean;
  welcomeMessage?: string | null;
  leaveMessage?: string | null;
  quarantineRoleId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotActivity {
  name: string;
  type: Exclude<ActivityType, ActivityType.Custom>;
  status?: PresenceUpdateStatus;
  url?: string;
}

// Specific type for subcommand modules
export interface SubcommandModule {
    name: string; // subcommand name
    description: string; // subcommand description
    configure: (subcommand: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder;
    execute: (interaction: ChatInputCommandInteraction, client: ClientWithCommands) => Promise<void>;
}