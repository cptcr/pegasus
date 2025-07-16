import { Client, Collection, SlashCommandBuilder, ChatInputCommandInteraction, ButtonInteraction, SelectMenuInteraction, ModalSubmitInteraction, VoiceState, GuildMember, User, TextChannel, VoiceChannel, CategoryChannel, Role, Guild } from 'discord.js';

export interface ExtendedClient extends Client {
  commands: Collection<string, Command>;
  config: BotConfig;
}

export interface Command {
  data: any; // More flexible to handle different builder types
  execute: (interaction: any) => Promise<any>; // More flexible return type
  cooldown?: number;
  permissions?: string[];
  category?: string;
}

export interface BotConfig {
  token: string;
  clientId: string;
  databaseUrl: string;
  nodeEnv: string;
}

export interface GuildSettings {
  guildId: string;
  prefix: string;
  modLogChannel?: string;
  muteRole?: string;
  joinToCreateCategory?: string;
  joinToCreateChannel?: string;
  ticketCategory?: string;
  autoRole?: string;
  welcomeChannel?: string;
  welcomeMessage?: string;
  leaveChannel?: string;
  leaveMessage?: string;
  xpEnabled: boolean;
  xpRate: number;
  xpCooldown: number;
  levelUpMessage?: string;
  levelUpChannel?: string;
  logChannel?: string;
  antiSpam: boolean;
  antiSpamAction: string;
  antiSpamThreshold: number;
  autoMod: boolean;
  filterProfanity: boolean;
  filterInvites: boolean;
  filterLinks: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  totalXp: number;
  voiceTime: number;
  messageCount: number;
  warnings: number;
  reputation: number;
  coins: number;
  lastXpGain: Date;
  lastVoiceJoin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModAction {
  id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  action: 'ban' | 'kick' | 'mute' | 'warn' | 'unmute' | 'unban';
  reason?: string;
  duration?: number;
  expiresAt?: Date;
  active: boolean;
  createdAt: Date;
}

export interface Ticket {
  id: string;
  guildId: string;
  userId: string;
  channelId: string;
  panelId: string;
  subject: string;
  status: 'open' | 'closed' | 'pending';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  closedBy?: string;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketPanel {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  title: string;
  description: string;
  color: string;
  category: string;
  supportRoles: string[];
  maxTickets: number;
  cooldown: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TempChannel {
  id: string;
  guildId: string;
  channelId: string;
  ownerId: string;
  parentId: string;
  createdAt: Date;
}

export interface GameSession {
  id: string;
  guildId: string;
  channelId: string;
  gameType: 'trivia' | 'math' | 'wordchain' | 'riddle';
  hostId: string;
  participants: string[];
  scores: Record<string, number>;
  status: 'waiting' | 'active' | 'ended';
  currentQuestion?: any;
  settings: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuildStats {
  guildId: string;
  totalMessages: number;
  totalCommands: number;
  totalVoiceTime: number;
  totalMembers: number;
  activeMembers: number;
  newMembers: number;
  leftMembers: number;
  bannedMembers: number;
  kickedMembers: number;
  mutedMembers: number;
  warnedMembers: number;
  ticketsCreated: number;
  ticketsClosed: number;
  date: Date;
}

export interface LogEvent {
  id: string;
  guildId: string;
  type: string;
  userId?: string;
  channelId?: string;
  roleId?: string;
  data: any;
  timestamp: Date;
}

export interface VoiceSession {
  userId: string;
  guildId: string;
  channelId: string;
  joinTime: Date;
  leaveTime?: Date;
  duration?: number;
  afk: boolean;
  muted: boolean;
  deafened: boolean;
}