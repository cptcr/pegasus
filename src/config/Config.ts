// src/config/Config.ts - Fixed with Proper Environment Loading
import { config } from 'dotenv';
import { ColorResolvable } from 'discord.js';

// Ensure dotenv is loaded before anything else
config();

// Debug logging to see what's actually loaded
console.log('🔍 Environment Debug:');
console.log(`   DISCORD_CLIENT_ID: ${process.env.DISCORD_CLIENT_ID ? '✓ SET' : '❌ NOT SET'}`);
console.log(`   DISCORD_BOT_TOKEN: ${process.env.DISCORD_BOT_TOKEN ? '✓ SET' : '❌ NOT SET'}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✓ SET' : '❌ NOT SET'}`);
console.log(`   TARGET_GUILD_ID: ${process.env.TARGET_GUILD_ID ? '✓ SET' : '❌ NOT SET'}`);

export const Config = {
  // Bot Configuration
  CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
  BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || '',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  // Guild Settings
  TARGET_GUILD_ID: process.env.TARGET_GUILD_ID || '554266392262737930',
  ADMIN_ROLE_ID: process.env.ADMIN_ROLE_ID || '797927858420187186',
  
  // Bot Settings
  PREFIX: process.env.PREFIX || '!',
  OWNER_ID: process.env.OWNER_ID || process.env.ADMIN_USER_ID || '931870926797160538',
  
  // Colors for embeds
  COLORS: {
    PRIMARY: '#5865F2' as ColorResolvable,
    SUCCESS: '#00FF00' as ColorResolvable,
    ERROR: '#FF0000' as ColorResolvable,
    WARNING: '#FFFF00' as ColorResolvable,
    INFO: '#00FFFF' as ColorResolvable,
    POLL: '#9932CC' as ColorResolvable,
    GIVEAWAY: '#FFD700' as ColorResolvable,
    TICKET: '#FFA500' as ColorResolvable,
    QUARANTINE: '#FF4500' as ColorResolvable,
    LEVEL: '#32CD32' as ColorResolvable
  } as const,
  
  // Emojis
  EMOJIS: {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    LOADING: '⏳',
    POLL: '📊',
    GIVEAWAY: '🎁',
    TICKET: '🎫',
    QUARANTINE: '🔒',
    LEVEL: '📈',
    MODERATOR: '🛡️',
    USER: '👤',
    TIME: '⏰',
    LOCK: '🔒',
    UNLOCK: '🔓',
    DELETE: '🗑️',
    EDIT: '✏️',
    ADD: '➕',
    REMOVE: '➖',
    ARROW_RIGHT: '➡️',
    ARROW_LEFT: '⬅️',
    ARROW_UP: '⬆️',
    ARROW_DOWN: '⬇️'
  } as const,
  
  // Cooldowns (in seconds)
  COOLDOWNS: {
    GLOBAL: 3,
    QUARANTINE: 10,
    POLL: 30,
    GIVEAWAY: 60,
    TICKET: 5,
    LEVEL: 1
  } as const,
  
  // Limits
  LIMITS: {
    POLL_OPTIONS: 10,
    POLL_DURATION_MAX: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    GIVEAWAY_DURATION_MAX: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    GIVEAWAY_WINNERS_MAX: 20,
    TICKET_SUBJECT_LENGTH: 100,
    QUARANTINE_REASON_LENGTH: 500,
    COMMAND_DESCRIPTION_LENGTH: 100
  } as const,
  
  // XP and Leveling
  XP: {
    MESSAGE_MIN: 15,
    MESSAGE_MAX: 25,
    VOICE_PER_MINUTE: 10,
    COOLDOWN: 60000, // 1 minute in ms
    LEVEL_MULTIPLIER: 100 // XP needed = level * multiplier
  } as const,
  
  // Quarantine Settings
  QUARANTINE: {
    DEFAULT_DURATION: 24 * 60 * 60 * 1000, // 24 hours in ms
    MAX_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    CHECK_INTERVAL: 5 * 60 * 1000 // 5 minutes in ms
  } as const,
  
  // Poll Settings
  POLL: {
    MIN_DURATION: 5 * 60 * 1000, // 5 minutes in ms
    MAX_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    MAX_OPTIONS: 10,
    VOTE_EMOJIS: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
  } as const,
  
  // Giveaway Settings
  GIVEAWAY: {
    MIN_DURATION: 10 * 60 * 1000, // 10 minutes in ms
    MAX_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    MAX_WINNERS: 20,
    ENTRY_EMOJI: '🎉'
  } as const,
  
  // Ticket Settings
  TICKET: {
    MAX_OPEN_PER_USER: 3,
    AUTO_CLOSE_INACTIVE: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    TRANSCRIPT_CHANNEL_SUFFIX: '-transcripts'
  } as const,
  
  // Logging
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    FILE: process.env.LOG_FILE || 'logs/pegasus.log',
    MAX_SIZE: '10mb',
    MAX_FILES: 5
  } as const,
  
  // API Settings
  API: {
    PORT: parseInt(process.env.PORT || '3000'),
    DASHBOARD_PORT: parseInt(process.env.DASHBOARD_PORT || '3001'),
    WEBSOCKET_PORT: parseInt(process.env.WEBSOCKET_PORT || '3002')
  } as const,
  
  // Feature Flags
  FEATURES: {
    ENABLE_LEVELING: process.env.ENABLE_LEVELING !== 'false',
    ENABLE_MODERATION: process.env.ENABLE_MODERATION !== 'false',
    ENABLE_POLLS: process.env.ENABLE_POLLS !== 'false',
    ENABLE_GIVEAWAYS: process.env.ENABLE_GIVEAWAYS !== 'false',
    ENABLE_TICKETS: process.env.ENABLE_TICKETS !== 'false',
    ENABLE_QUARANTINE: process.env.ENABLE_QUARANTINE !== 'false',
    ENABLE_WEB_DASHBOARD: process.env.ENABLE_WEB_DASHBOARD !== 'false',
    ENABLE_API: process.env.ENABLE_API !== 'false'
  } as const,
  
  // Permissions
  PERMISSIONS: {
    QUARANTINE: ['ManageRoles', 'ModerateMembers'],
    POLL: ['SendMessages', 'AddReactions'],
    GIVEAWAY: ['SendMessages', 'AddReactions'],
    TICKET: ['ManageChannels', 'ManageRoles'],
    MODERATION: ['ModerateMembers', 'ManageMessages']
  } as const,
  
  // Database Settings
  DATABASE: {
    POOL_SIZE: parseInt(process.env.DB_POOL_SIZE || '10'),
    TIMEOUT: parseInt(process.env.DB_TIMEOUT || '30000'),
    RETRY_ATTEMPTS: parseInt(process.env.DB_RETRY_ATTEMPTS || '3')
  } as const,
  
  // Cache Settings
  CACHE: {
    TTL: parseInt(process.env.CACHE_TTL || '300'), // 5 minutes
    MAX_SIZE: parseInt(process.env.CACHE_MAX_SIZE || '1000')
  } as const,
  
  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: 60 * 1000, // 1 minute
    MAX_REQUESTS: 100,
    SKIP_SUCCESSFUL_REQUESTS: false
  } as const,
  
  // Development Settings
  DEV: {
    GUILD_ID: process.env.DEV_GUILD_ID || '',
    DEBUG: process.env.NODE_ENV === 'development',
    VERBOSE_LOGGING: process.env.VERBOSE_LOGGING === 'true'
  } as const
} as const;

// Validation function with better debugging
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  console.log('🔍 Config Validation Debug:');
  console.log(`   Config.CLIENT_ID: "${Config.CLIENT_ID}"`);
  console.log(`   Config.BOT_TOKEN: "${Config.BOT_TOKEN ? Config.BOT_TOKEN.substring(0, 10) + '...' : 'EMPTY'}"`);
  console.log(`   Config.DATABASE_URL: "${Config.DATABASE_URL ? Config.DATABASE_URL.substring(0, 20) + '...' : 'EMPTY'}"`);
  console.log(`   Config.TARGET_GUILD_ID: "${Config.TARGET_GUILD_ID}"`);
  
  if (!Config.CLIENT_ID) {
    errors.push('DISCORD_CLIENT_ID is required');
  }
  
  if (!Config.BOT_TOKEN) {
    errors.push('DISCORD_BOT_TOKEN is required');
  }
  
  if (!Config.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }
  
  if (!Config.TARGET_GUILD_ID) {
    errors.push('TARGET_GUILD_ID is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export type ConfigType = typeof Config;