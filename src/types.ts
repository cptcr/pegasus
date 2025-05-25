// src/types.ts - TypeScript type definitions
import { 
  Collection, 
  CommandInteraction, 
  Message, 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  Client as DiscordClient, 
  ClientEvents 
} from 'discord.js';
import { PrismaClient } from '@prisma/client';

export interface BotConfig {
  devGuilds: string[];
  devUsers: string[];
  devRoles: string[];
  defaultPrefix: string;
  enabledFeatures: {
    leveling: boolean;
    moderation: boolean;
    geizhals: boolean;
    polls: boolean;
    giveaways: boolean;
    tickets: boolean;
    music: boolean;
    joinToCreate: boolean;
  };
  debug: boolean;
}

export interface SlashCommand {
  data: SlashCommandBuilder | any;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  cooldown?: number; // Cooldown in seconds
  category?: string;
  devOnly?: boolean;
  testOnly?: boolean;
  enabled?: boolean;
}

export interface PrefixCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  execute: (message: Message, args: string[]) => Promise<void>;
  cooldown?: number; // Cooldown in seconds
  category?: string;
  devOnly?: boolean;
  enabled?: boolean;
}

export interface Feature {
  name: string;
  initialize: (client: Client) => Promise<void>;
  shutdown?: (client: Client) => Promise<void>;
  enabled?: boolean;
}

export interface Event<K extends keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (...args: ClientEvents[K]) => Promise<void>;
}

export interface Client extends DiscordClient {
  commands: Collection<string, PrefixCommand>;
  slashCommands: Collection<string, SlashCommand>;
  cooldowns: Collection<string, Collection<string, number>>;
  config: BotConfig;
  prisma: PrismaClient;
}

export interface CooldownConfig {
  userId: string;
  commandName: string;
  timestamp: number;
  cooldownAmount: number;
}

export interface GuildSettings {
  prefix: string;
  enabledFeatures: {
    leveling: boolean;
    moderation: boolean;
    geizhals: boolean;
    polls: boolean;
    giveaways: boolean;
    tickets: boolean;
    music: boolean;
    joinToCreate: boolean;
  };
  channels: {
    modLog?: string;
    levelUp?: string;
    welcome?: string;
    geizhals?: string;
    joinToCreate?: string;
  };
  roles: {
    quarantine?: string;
  };
  messages: {
    welcome?: string;
    leave?: string;
  };
}