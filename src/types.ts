// src/types.ts - TypeScript-Typdefinitionen
import {
  Collection,
  CommandInteraction,
  Message,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client as DiscordClient, // Original Discord.js Client
  ClientEvents,
  PresenceUpdateStatus,
  ActivityType
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

// Erweitert den Discord.js Client um unsere spezifischen Eigenschaften
export interface ClientWithCommands extends DiscordClient {
  commands: Collection<string, PrefixCommand>;
  slashCommands: Collection<string, SlashCommand>;
  cooldowns: Collection<string, Collection<string, number>>;
  config: BotConfig;
  prisma: PrismaClient;
  io?: any; // Für Socket.IO-Integration mit dem Dashboard (optional)
}

export interface SlashCommand {
  data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">; // Vereinfacht für den Anfang
  execute: (interaction: ChatInputCommandInteraction, client: ClientWithCommands) => Promise<void>;
  cooldown?: number; // Cooldown in Sekunden
  category?: string;
  devOnly?: boolean;
  testOnly?: boolean; // Für Tests in devGuilds
  enabled?: boolean; // Um Befehle einfach zu de-/aktivieren
  permissions?: string[]; // Benötigte Berechtigungen für den Benutzer
  botPermissions?: string[]; // Benötigte Berechtigungen für den Bot
}

export interface PrefixCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string; // Beispiel: !befehl <argument1> [optionalArgument]
  execute: (message: Message, args: string[], client: ClientWithCommands) => Promise<void>;
  cooldown?: number; // Cooldown in Sekunden
  category?: string;
  devOnly?: boolean;
  enabled?: boolean; // Um Befehle einfach zu de-/aktivieren
  permissions?: string[]; // Benötigte Berechtigungen für den Benutzer
  botPermissions?: string[]; // Benötigte Berechtigungen für den Bot
}

export interface Feature {
  name: string;
  description?: string;
  initialize: (client: ClientWithCommands) => Promise<void>;
  shutdown?: (client: ClientWithCommands) => Promise<void>;
  enabled?: boolean; // Feature-spezifische Aktivierung
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

// Für Gildenspezifische Einstellungen in der Datenbank
export interface GuildSettings {
  id: string; // Discord Guild ID
  prefix: string;
  modLogChannelId?: string | null;
  levelUpChannelId?: string | null;
  welcomeChannelId?: string | null;
  geizhalsChannelId?: string | null;
  joinToCreateChannelId?: string | null; // Voice channel to join to create a new one
  joinToCreateCategoryId?: string | null; // Category where new voice channels are created

  enableLeveling: boolean;
  enableModeration: boolean;
  enableGeizhals: boolean;
  enablePolls: boolean;
  enableGiveaways: boolean;
  enableAutomod: boolean;
  enableTickets: boolean;
  enableMusic: boolean;
  enableJoinToCreate: boolean;

  welcomeMessage?: string | null; // Nachricht, wenn ein Benutzer beitritt
  leaveMessage?: string | null;   // Nachricht, wenn ein Benutzer verlässt

  quarantineRoleId?: string | null; // Rolle für Benutzer in Quarantäne

  createdAt: Date;
  updatedAt: Date;
}

// Bot-Status für Aktivitätsanzeige
export interface BotActivity {
  name: string;
  type: Exclude<ActivityType, ActivityType.Custom>; // Custom wird nicht direkt unterstützt
  status?: PresenceUpdateStatus; // online, idle, dnd, invisible
  url?: string; // Für Streaming-Status
}
