import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  PermissionResolvable,
  AutocompleteInteraction,
} from 'discord.js';

export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  category: CommandCategory;
  cooldown?: number; // in seconds
  permissions?: PermissionResolvable[];
  botPermissions?: PermissionResolvable[];
  guildOnly?: boolean;
  ownerOnly?: boolean;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export enum CommandCategory {
  Admin = 'admin',
  Moderation = 'moderation',
  Utility = 'utility',
  Fun = 'fun',
  Economy = 'economy',
  XP = 'xp',
  Giveaways = 'giveaways',
  Tickets = 'tickets',
}

export interface CommandError {
  code: string;
  message: string;
  details?: unknown;
}
