import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenvConfig();

// Environment configuration schema
const envSchema = z.object({
  // Bot Configuration
  BOT_TOKEN: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  
  // Database Configuration
  DATABASE_URL: z.string().url(),
  DATABASE_MAX_CONNECTIONS: z.string().default('20').transform(Number),
  DATABASE_IDLE_TIMEOUT: z.string().default('30000').transform(Number),
  DATABASE_CONNECTION_TIMEOUT: z.string().default('2000').transform(Number),
  DATABASE_SSL: z.enum(['true', 'false']).default('true').transform(val => val === 'true'),
  
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),
  
  // Redis Configuration (optional)
  REDIS_URL: z.string().url().optional(),
  REDIS_PREFIX: z.string().default('pegasus:'),
  
  // API Keys (optional)
  STEAM_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  
  // Feature Flags
  ENABLE_PREMIUM: z.enum(['true', 'false']).default('true').transform(val => val === 'true'),
  ENABLE_ANALYTICS: z.enum(['true', 'false']).default('true').transform(val => val === 'true'),
  ENABLE_AUTO_BACKUP: z.enum(['true', 'false']).default('false').transform(val => val === 'true'),
  
  // Performance Configuration
  COMMAND_COOLDOWN_MS: z.string().default('3000').transform(Number),
  XP_COOLDOWN_MS: z.string().default('60000').transform(Number),
  VOICE_XP_INTERVAL_MS: z.string().default('60000').transform(Number),
  TEMP_CHANNEL_CLEANUP_MS: z.string().default('300000').transform(Number),
  
  // Security Configuration
  MAX_WARNINGS_BEFORE_BAN: z.string().default('5').transform(Number),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('10').transform(Number),
  
  // Backup Configuration
  BACKUP_INTERVAL_HOURS: z.string().default('24').transform(Number),
  BACKUP_RETENTION_DAYS: z.string().default('7').transform(Number),
  BACKUP_PATH: z.string().default('./backups'),
  
  // Monitoring Configuration
  METRICS_PORT: z.string().default('9090').transform(Number),
  HEALTH_CHECK_PORT: z.string().default('3000').transform(Number),
  ENABLE_PROMETHEUS: z.enum(['true', 'false']).default('false').transform(val => val === 'true'),
  ENABLE_MONITORING_DASHBOARD: z.enum(['true', 'false']).default('false').transform(val => val === 'true'),
  DYNAMIC_PORT: z.string().optional().transform((val) => val ? Number(val) : undefined),
  
  // Webhook URLs (optional)
  ERROR_WEBHOOK_URL: z.string().url().optional(),
  AUDIT_WEBHOOK_URL: z.string().url().optional(),
});

// Load and validate environment variables
const env = envSchema.parse(process.env);

// Load JSON configuration files
interface JsonConfig {
  colors: Record<string, string>;
  emojis: Record<string, string>;
  limits: Record<string, number>;
  messages: Record<string, string>;
  features: Record<string, boolean>;
}

const loadJsonConfig = (): JsonConfig => {
  const configPath = join(process.cwd(), 'config.json');
  const defaultConfig: JsonConfig = {
    colors: {
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
    },
    emojis: {
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
      gift: '🎁',
      history: '📜',
      plus: '➕',
      minus: '➖',
      refresh: '🔄',
      trash: '🗑️',
      edit: '✏️',
      save: '💾',
      cancel: '🚫',
      back: '◀️',
      forward: '▶️',
      up: '⬆️',
      down: '⬇️',
      // New emojis for enhanced moderation
      delete: '🗑️',
      purge: '🧹',
      slowmode: '🐌',
      lock: '🔒',
      unlock: '🔓',
      timeout: '⏰',
      reset: '🔄',
      avatar: '🖼️',
      banner: '🏞️',
      role: '🎭',
      channel: '#️⃣',
      server: '🏰',
      user: '👤',
      invite: '📧',
      afk: '💤',
      dice: '🎲',
      coin: '🪙',
      magic8ball: '🎱',
      search: '🔍',
      notes: '📝',
      permissions: '🔐',
      online: '🟢',
      idle: '🟡',
      dnd: '🔴',
      offline: '⚫',
      streaming: '🟣',
      boost: '💎',
      member: '👥',
      owner: '👑',
      admin: '⚡',
      mod: '🛡️',
      verified: '✅',
      partner: '🤝',
      hypesquad: '🎉',
      nitro: '💎',
      early: '⭐',
      bug: '🐛',
      staff: '👨‍💼',
    },
    limits: {
      maxTicketsPerUser: 5,
      maxWarnings: 3,
      maxTempChannels: 10,
      maxGameParticipants: 20,
      maxGiveawayWinners: 20,
      maxCustomCommands: 50,
      maxReactionRoles: 25,
      maxShopItems: 100,
      maxInventoryItems: 250,
      maxReminders: 10,
      embedFieldLimit: 25,
      embedCharacterLimit: 6000,
    },
    messages: {
      noPermission: 'You do not have permission to use this command.',
      commandCooldown: 'Please wait {time} before using this command again.',
      botMissingPermissions: 'I need the following permissions: {permissions}',
      unexpectedError: 'An unexpected error occurred. Please try again later.',
      maintenanceMode: 'The bot is currently in maintenance mode. Please try again later.',
    },
    features: {
      enableWelcomeImages: true,
      enableLevelUpNotifications: true,
      enableAutoModeration: true,
      enableEconomySystem: true,
      enableGiveaways: true,
      enableTickets: true,
      enableGames: true,
      enableReminders: true,
      enableCustomCommands: true,
      enableReactionRoles: true,
      enableVoiceTracking: true,
      enableAnalytics: true,
    },
  };

  if (existsSync(configPath)) {
    try {
      const fileContent = readFileSync(configPath, 'utf-8');
      const loadedConfig = JSON.parse(fileContent);
      return { ...defaultConfig, ...loadedConfig };
    } catch (error) {
      console.warn('Failed to load config.json, using defaults:', error);
      return defaultConfig;
    }
  }

  return defaultConfig;
};

const jsonConfig = loadJsonConfig();

// Export the complete configuration
export const config = {
  // Environment variables
  ...env,
  
  // JSON configuration
  ...jsonConfig,
  
  // Computed values
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  // Database connection string with SSL
  getDatabaseConfig: () => ({
    connectionString: env.DATABASE_URL,
    ssl: false, // Pterodactyl servers don't use SSL for local connections
    max: env.DATABASE_MAX_CONNECTIONS,
    idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT,
    connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT,
  }),
  
  // Feature toggles
  isFeatureEnabled: (feature: string): boolean => {
    return jsonConfig.features[feature] ?? false;
  },
  
  // Get color by name
  getColor: (name: string): string => {
    return jsonConfig.colors[name] || jsonConfig.colors.primary;
  },
  
  // Get emoji by name
  getEmoji: (name: string): string => {
    return jsonConfig.emojis[name] || '❓';
  },
  
  // Get limit by name
  getLimit: (name: string): number => {
    return jsonConfig.limits[name] || 10;
  },
  
  // Get message by key with replacements
  getMessage: (key: string, replacements?: Record<string, string>): string => {
    let message = jsonConfig.messages[key] || key;
    if (replacements) {
      Object.entries(replacements).forEach(([placeholder, value]) => {
        message = message.replace(`{${placeholder}}`, value);
      });
    }
    return message;
  },
};

// Type exports
export type Config = typeof config;
export type EnvironmentConfig = z.infer<typeof envSchema>;