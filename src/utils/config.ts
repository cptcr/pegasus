import { config as dotenvConfig } from 'dotenv';
import { BotConfig } from '../types';

dotenvConfig();

export const config: BotConfig = {
  token: process.env.BOT_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export const validateConfig = (): void => {
  const requiredEnvVars = ['BOT_TOKEN', 'CLIENT_ID', 'DATABASE_URL'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
};

export const colors = {
  primary: '#0099ff',
  success: '#00ff00',
  warning: '#ffff00',
  error: '#ff0000',
  info: '#00ffff',
  purple: '#9932cc',
  orange: '#ffa500',
  pink: '#ff69b4',
  green: '#32cd32',
  red: '#dc143c',
  blue: '#4169e1',
  yellow: '#ffd700',
  gray: '#808080',
};

export const emojis = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  loading: '⏳',
  ban: '🔨',
  kick: '👢',
  mute: '🔇',
  unmute: '🔊',
  warn: '⚠️',
  ticket: '🎫',
  close: '🔒',
  open: '🔓',
  level: '📈',
  xp: '⭐',
  voice: '🎤',
  game: '🎮',
  stats: '📊',
  log: '📝',
  shield: '🛡️',
  crown: '👑',
  diamond: '💎',
  fire: '🔥',
  tada: '🎉',
};

export const limits = {
  maxTicketsPerUser: 5,
  maxWarnings: 3,
  maxTempChannels: 10,
  maxGameParticipants: 20,
  xpCooldown: 60000, // 1 minute
  commandCooldown: 3000, // 3 seconds
  voiceXpInterval: 60000, // 1 minute
  autoDeleteTempChannels: 300000, // 5 minutes
};