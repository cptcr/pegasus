import { EmbedBuilder } from 'discord.js';

export function createEmbed(title?: string, description?: string, color?: number): EmbedBuilder {
  const embed = new EmbedBuilder();
  
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (color) embed.setColor(color);
  
  return embed;
}

export function createSuccessEmbed(title: string, description?: string): EmbedBuilder {
  return createEmbed(title, description, 0x00FF00);
}

export function createErrorEmbed(title: string, description?: string): EmbedBuilder {
  return createEmbed(title, description, 0xFF0000);
}

export function createInfoEmbed(title: string, description?: string): EmbedBuilder {
  return createEmbed(title, description, 0x0099FF);
}

export function createWarningEmbed(title: string, description?: string): EmbedBuilder {
  return createEmbed(title, description, 0xFFFF00);
}

// Default export for backward compatibility
export const embedBuilder = {
  createEmbed,
  createSuccessEmbed,
  createErrorEmbed,
  createInfoEmbed,
  createWarningEmbed
};