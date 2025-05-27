// src/types/CommandMetadata.ts - Enhanced Command Metadata System
export interface CommandMetadata {
  name: string;
  description: string;
  category: string;
  usage?: string;
  examples?: string[];
  permissions?: string[];
  cooldown?: number;
  aliases?: string[];
  guildOnly?: boolean;
  ownerOnly?: boolean;
  nsfw?: boolean;
  hidden?: boolean;
  premium?: boolean;
  subcommands?: SubcommandMetadata[];
}

export interface SubcommandMetadata {
  name: string;
  description: string;
  usage?: string;
  examples?: string[];
}

export interface CategoryInfo {
  name: string;
  description: string;
  emoji: string;
  color: number;
}