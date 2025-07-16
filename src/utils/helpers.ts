import { GuildMember, PermissionFlagsBits, EmbedBuilder, TextChannel, User, Guild } from 'discord.js';
import { colors, emojis } from './config';
import ms from 'ms';

export const formatTime = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

export const parseDuration = (duration: string): number => {
  const parsed = ms(duration);
  if (!parsed) throw new Error('Invalid duration format');
  return parsed;
};

export const createEmbed = (options: {
  title?: string;
  description?: string;
  color?: string;
  footer?: string;
  timestamp?: boolean;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  thumbnail?: string;
  image?: string;
  author?: { name: string; iconURL?: string };
}): EmbedBuilder => {
  const embed = new EmbedBuilder();

  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.color) embed.setColor(options.color as any);
  if (options.footer) embed.setFooter({ text: options.footer });
  if (options.timestamp) embed.setTimestamp();
  if (options.fields) {
    options.fields.forEach(field => {
      embed.addFields({ name: field.name, value: field.value, inline: field.inline || false });
    });
  }
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  if (options.author) embed.setAuthor(options.author);

  return embed;
};

export const createSuccessEmbed = (title: string, description: string): EmbedBuilder => {
  return createEmbed({
    title: `${emojis.success} ${title}`,
    description,
    color: colors.success,
    timestamp: true,
  });
};

export const createErrorEmbed = (title: string, description: string): EmbedBuilder => {
  return createEmbed({
    title: `${emojis.error} ${title}`,
    description,
    color: colors.error,
    timestamp: true,
  });
};

export const createWarningEmbed = (title: string, description: string): EmbedBuilder => {
  return createEmbed({
    title: `${emojis.warning} ${title}`,
    description,
    color: colors.warning,
    timestamp: true,
  });
};

export const createInfoEmbed = (title: string, description: string): EmbedBuilder => {
  return createEmbed({
    title: `${emojis.info} ${title}`,
    description,
    color: colors.info,
    timestamp: true,
  });
};

export const hasPermission = (member: GuildMember, permission: bigint): boolean => {
  return member.permissions.has(permission);
};

export const isHigherRole = (member1: GuildMember, member2: GuildMember): boolean => {
  return member1.roles.highest.position > member2.roles.highest.position;
};

export const canModerate = (moderator: GuildMember, target: GuildMember): boolean => {
  if (moderator.id === target.id) return false;
  if (target.id === target.guild.ownerId) return false;
  if (moderator.id === moderator.guild.ownerId) return true;
  return isHigherRole(moderator, target);
};

export const getXpForLevel = (level: number): number => {
  return Math.floor(100 * Math.pow(level, 1.5));
};

export const getLevelFromXp = (xp: number): number => {
  return Math.floor(Math.pow(xp / 100, 1 / 1.5));
};

export const getXpToNextLevel = (currentXp: number, currentLevel: number): number => {
  const nextLevelXp = getXpForLevel(currentLevel + 1);
  return nextLevelXp - currentXp;
};

export const getRandomXp = (min: number = 10, max: number = 25): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

export const createProgressBar = (current: number, max: number, length: number = 20): string => {
  if (max <= 0) return '░'.repeat(length) + ' 0%';
  const percentage = Math.min(current / max, 1);
  const progress = Math.max(0, Math.min(Math.round(percentage * length), length));
  const remaining = Math.max(0, length - progress);
  const progressBar = '█'.repeat(progress) + '░'.repeat(remaining);
  return `${progressBar} ${Math.round(percentage * 100)}%`;
};

export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
};

export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const formatUserMention = (userId: string): string => {
  return `<@${userId}>`;
};

export const formatChannelMention = (channelId: string): string => {
  return `<#${channelId}>`;
};

export const formatRoleMention = (roleId: string): string => {
  return `<@&${roleId}>`;
};

export const getPermissionLevel = (member: GuildMember): number => {
  if (member.id === member.guild.ownerId) return 4;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return 3;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return 2;
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return 1;
  return 0;
};

export const validateChannel = (channel: any): channel is TextChannel => {
  return channel && channel.isTextBased() && !channel.isDMBased();
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

export const generateRandomId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return `${diffSeconds}s ago`;
};