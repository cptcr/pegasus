import { z } from 'zod';

// ===========================
// COMMON VALIDATION SCHEMAS
// ===========================

export const CommonSchemas = {
  // Discord IDs - Secure validation with strict regex
  snowflake: z.string()
    .regex(/^\d{17,19}$/, 'Invalid Discord ID')
    .refine(val => {
      const parsed = BigInt(val);
      // Discord epoch: 1420070400000
      const timestamp = (parsed >> 22n) + 1420070400000n;
      return timestamp < BigInt(Date.now() + 86400000); // Not from future
    }, 'Invalid Discord snowflake'),
  
  // Safe string inputs with XSS prevention
  safeString: z.string()
    .transform(str => str.trim())
    .refine(str => !str.includes('<script'), 'Potentially unsafe content detected')
    .refine(str => !str.includes('javascript:'), 'Potentially unsafe content detected'),
  
  // User inputs with length limits
  username: z.string()
    .min(1, 'Username is required')
    .max(32, 'Username too long')
    .regex(/^[a-zA-Z0-9_\-]+$/, 'Username contains invalid characters'),
  
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title too long')
    .transform(str => str.trim()),
  
  description: z.string()
    .max(4000, 'Description too long')
    .transform(str => str.trim())
    .optional(),
  
  // Safe numbers with bounds
  positiveInt: z.number()
    .int('Must be a whole number')
    .min(0, 'Must be positive')
    .finite('Must be a finite number'),
  
  amount: z.number()
    .int('Amount must be a whole number')
    .min(1, 'Amount must be at least 1')
    .max(1000000000, 'Amount too large')
    .finite('Must be a finite number'),
  
  percentage: z.number()
    .min(0, 'Percentage cannot be negative')
    .max(100, 'Percentage cannot exceed 100')
    .finite('Must be a finite number'),
  
  // Time validation
  duration: z.number()
    .int('Duration must be whole seconds')
    .min(1, 'Duration too short')
    .max(31536000, 'Duration cannot exceed 1 year'),
  
  // URL validation with safety checks
  safeUrl: z.string()
    .url('Invalid URL format')
    .refine(url => {
      try {
        const parsed = new URL(url);
        const blockedDomains = [
          'grabify.link', 'iplogger.org', 'blasze.tk',
          'ps3cfw.com', '2no.co', 'yip.su', 'curiouscat.club'
        ];
        return !blockedDomains.some(domain => 
          parsed.hostname.includes(domain)
        );
      } catch {
        return false;
      }
    }, 'URL from blocked domain'),
  
  // File attachment validation
  attachment: z.object({
    url: z.string().url('Invalid attachment URL'),
    name: z.string()
      .max(255, 'Filename too long')
      .refine(name => {
        const dangerous = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.jar'];
        return !dangerous.some(ext => name.toLowerCase().endsWith(ext));
      }, 'Dangerous file type not allowed'),
    size: z.number()
      .max(8388608, 'File too large (max 8MB)')
      .positive('Invalid file size'),
    contentType: z.string().optional(),
  }),
  
  // Array limits
  limitedArray: (schema: z.ZodTypeAny, maxLength = 100) => 
    z.array(schema).max(maxLength, `Array cannot exceed ${maxLength} items`),
  
  // Hex color validation
  hexColor: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format'),
  
  // Language codes
  language: z.enum(['en', 'de', 'es', 'fr'], {
    errorMap: () => ({ message: 'Unsupported language' })
  }),
};

// ===========================
// WARN COMMAND SCHEMAS
// ===========================

export const WarnSchemas = {
  create: z.object({
    user: CommonSchemas.snowflake,
    title: CommonSchemas.title,
    description: CommonSchemas.description,
    level: z.number()
      .int()
      .min(1, 'Level must be at least 1')
      .max(10, 'Level cannot exceed 10')
      .default(1),
    proof: CommonSchemas.attachment.optional(),
  }),
  
  edit: z.object({
    warnId: z.string()
      .regex(/^W[a-zA-Z0-9]{10}$/, 'Invalid warning ID format'),
    title: CommonSchemas.title.optional(),
    description: CommonSchemas.description,
  }),
  
  lookup: z.object({
    warnId: z.string()
      .regex(/^W[a-zA-Z0-9]{10}$/, 'Invalid warning ID format'),
  }),
  
  view: z.object({
    user: CommonSchemas.snowflake,
    page: z.number().int().min(1).max(100).default(1),
  }),
  
  automationCreate: z.object({
    name: CommonSchemas.title,
    description: CommonSchemas.description,
    triggerType: z.enum(['warn_count', 'warn_level', 'total_points']),
    triggerValue: z.number()
      .int()
      .min(1)
      .max(100),
    actions: z.array(z.object({
      type: z.enum(['ban', 'kick', 'timeout', 'role_add', 'role_remove', 'message']),
      duration: CommonSchemas.duration.optional(),
      roleId: CommonSchemas.snowflake.optional(),
      message: z.string().max(2000).optional(),
    }))
    .min(1, 'At least one action required')
    .max(5, 'Maximum 5 actions allowed'),
  }),
  
  automationDelete: z.object({
    automationId: z.string().uuid('Invalid automation ID'),
  }),
};

// ===========================
// MODERATION COMMAND SCHEMAS
// ===========================

export const ModerationSchemas = {
  ban: z.object({
    user: CommonSchemas.snowflake,
    reason: z.string()
      .min(1, 'Reason is required')
      .max(512, 'Reason too long'),
    duration: CommonSchemas.duration.optional(),
    deleteMessages: z.number()
      .int()
      .min(0)
      .max(7)
      .default(0),
  }),
  
  kick: z.object({
    user: CommonSchemas.snowflake,
    reason: z.string()
      .min(1, 'Reason is required')
      .max(512, 'Reason too long'),
  }),
  
  timeout: z.object({
    user: CommonSchemas.snowflake,
    duration: z.number()
      .int()
      .min(60, 'Minimum timeout is 1 minute')
      .max(2419200, 'Maximum timeout is 28 days'),
    reason: z.string()
      .min(1, 'Reason is required')
      .max(512, 'Reason too long'),
  }),
  
  resetXp: z.object({
    user: CommonSchemas.snowflake,
    confirm: z.boolean(),
  }),
};

// ===========================
// GIVEAWAY COMMAND SCHEMAS
// ===========================

export const GiveawaySchemas = {
  start: z.object({
    title: CommonSchemas.title,
    description: CommonSchemas.description,
    prize: z.string()
      .min(1, 'Prize is required')
      .max(255, 'Prize description too long'),
    duration: z.number()
      .int()
      .min(60, 'Minimum duration is 1 minute')
      .max(2592000, 'Maximum duration is 30 days'),
    winners: z.number()
      .int()
      .min(1, 'At least 1 winner required')
      .max(20, 'Maximum 20 winners'),
    channel: CommonSchemas.snowflake.optional(),
    requiredRoles: CommonSchemas.limitedArray(CommonSchemas.snowflake, 10).optional(),
    blacklistedRoles: CommonSchemas.limitedArray(CommonSchemas.snowflake, 10).optional(),
    minLevel: z.number()
      .int()
      .min(0)
      .max(1000)
      .optional(),
    bonusEntries: z.array(z.object({
      roleId: CommonSchemas.snowflake,
      entries: z.number()
        .int()
        .min(1)
        .max(10),
    }))
    .max(10)
    .optional(),
  }),
  
  end: z.object({
    messageId: CommonSchemas.snowflake,
    force: z.boolean().default(false),
  }),
  
  reroll: z.object({
    messageId: CommonSchemas.snowflake,
    winners: z.number()
      .int()
      .min(1)
      .max(20)
      .optional(),
  }),
  
  simple: z.object({
    prize: z.string()
      .min(1, 'Prize is required')
      .max(255, 'Prize description too long'),
    duration: z.number()
      .int()
      .min(60, 'Minimum duration is 1 minute')
      .max(604800, 'Maximum duration is 7 days'),
    winners: z.number()
      .int()
      .min(1)
      .max(10)
      .default(1),
  }),
};

// ===========================
// ECONOMY COMMAND SCHEMAS
// ===========================

export const EconomySchemas = {
  balance: z.object({
    user: CommonSchemas.snowflake.optional(),
  }),
  
  daily: z.object({}), // No parameters
  
  work: z.object({}), // No parameters
  
  gamble: z.object({
    game: z.enum(['dice', 'coinflip', 'slots', 'blackjack', 'roulette']),
    amount: z.union([
      z.literal('all'),
      z.literal('half'),
      CommonSchemas.amount,
    ]),
    choice: z.string().optional(), // For game-specific choices
  }).refine(data => {
    if (data.game === 'coinflip' && !data.choice) {
      return false;
    }
    if (data.game === 'roulette' && !data.choice) {
      return false;
    }
    return true;
  }, 'Choice required for this game'),
  
  shop: z.object({
    action: z.enum(['view', 'buy', 'info']),
    item: z.string()
      .max(50)
      .optional(),
    quantity: z.number()
      .int()
      .min(1)
      .max(99)
      .default(1),
  }),
  
  rob: z.object({
    user: CommonSchemas.snowflake,
  }),
};

// ===========================
// CONFIGURATION SCHEMAS
// ===========================

export const ConfigSchemas = {
  xp: z.object({
    enabled: z.boolean().optional(),
    messageXp: z.object({
      min: z.number().int().min(0).max(100),
      max: z.number().int().min(0).max(100),
    }).refine(data => data.min <= data.max, 'Min XP must be less than or equal to max XP')
      .optional(),
    voiceXp: z.number()
      .int()
      .min(0)
      .max(100)
      .optional(),
    cooldown: z.number()
      .int()
      .min(0)
      .max(300)
      .optional(),
    multipliers: CommonSchemas.limitedArray(z.object({
      roleId: CommonSchemas.snowflake,
      multiplier: z.number()
        .min(0.1)
        .max(10),
    }), 20).optional(),
    levelRoles: CommonSchemas.limitedArray(z.object({
      level: z.number().int().min(1).max(1000),
      roleId: CommonSchemas.snowflake,
    }), 100).optional(),
    ignoredChannels: CommonSchemas.limitedArray(CommonSchemas.snowflake, 50).optional(),
    ignoredRoles: CommonSchemas.limitedArray(CommonSchemas.snowflake, 20).optional(),
  }),
  
  eco: z.object({
    currencySymbol: z.string()
      .min(1)
      .max(10)
      .default('$'),
    dailyAmount: CommonSchemas.amount.default(100),
    workAmount: z.object({
      min: CommonSchemas.amount,
      max: CommonSchemas.amount,
    }).refine(data => data.min <= data.max, 'Min amount must be less than or equal to max'),
    robSuccessRate: CommonSchemas.percentage.default(50),
    robCooldown: CommonSchemas.duration.default(86400),
    shopItems: CommonSchemas.limitedArray(z.object({
      name: CommonSchemas.title,
      description: CommonSchemas.description,
      price: CommonSchemas.amount,
      stock: z.number().int().min(-1).max(9999).default(-1), // -1 = unlimited
      roleReward: CommonSchemas.snowflake.optional(),
      xpBoost: z.number().min(0).max(10).optional(),
    }), 50).optional(),
  }),
  
  lang: z.object({
    language: CommonSchemas.language,
  }),
  
  welcome: z.object({
    enabled: z.boolean(),
    channel: CommonSchemas.snowflake,
    message: z.string()
      .max(2000)
      .refine(msg => {
        const placeholders = msg.match(/\{\{.*?\}\}/g) || [];
        const allowed = ['{{user}}', '{{username}}', '{{server}}', '{{memberCount}}'];
        return placeholders.every(p => allowed.includes(p));
      }, 'Invalid placeholder used'),
    embedEnabled: z.boolean().default(false),
    embedColor: CommonSchemas.hexColor.optional(),
    autoroles: CommonSchemas.limitedArray(CommonSchemas.snowflake, 10).optional(),
  }),
  
  autorole: z.object({
    enabled: z.boolean(),
    roles: CommonSchemas.limitedArray(CommonSchemas.snowflake, 10),
    delay: z.number()
      .int()
      .min(0)
      .max(3600)
      .default(0),
  }),
  
  goodbye: z.object({
    enabled: z.boolean(),
    channel: CommonSchemas.snowflake,
    message: z.string()
      .max(2000)
      .refine(msg => {
        const placeholders = msg.match(/\{\{.*?\}\}/g) || [];
        const allowed = ['{{user}}', '{{username}}', '{{server}}', '{{memberCount}}'];
        return placeholders.every(p => allowed.includes(p));
      }, 'Invalid placeholder used'),
  }),
};

// ===========================
// TICKET COMMAND SCHEMAS
// ===========================

export const TicketSchemas = {
  panelCreate: z.object({
    title: CommonSchemas.title,
    description: CommonSchemas.description,
    category: CommonSchemas.snowflake,
    supportRoles: CommonSchemas.limitedArray(CommonSchemas.snowflake, 10)
      .min(1, 'At least one support role required'),
    buttonLabel: z.string()
      .min(1)
      .max(80)
      .default('Create Ticket'),
    buttonStyle: z.enum(['Primary', 'Secondary', 'Success', 'Danger'])
      .default('Primary'),
    mentionRoles: z.boolean().default(true),
    requireReason: z.boolean().default(true),
    maxTickets: z.number()
      .int()
      .min(1)
      .max(10)
      .default(1),
    cooldown: z.number()
      .int()
      .min(0)
      .max(3600)
      .default(0),
  }),
  
  panelLoad: z.object({
    panelId: z.string().uuid('Invalid panel ID'),
    channel: CommonSchemas.snowflake.optional(),
  }),
  
  panelDelete: z.object({
    panelId: z.string().uuid('Invalid panel ID'),
  }),
  
  claim: z.object({
    silent: z.boolean().default(false),
  }),
  
  close: z.object({
    reason: z.string()
      .max(1000)
      .optional(),
    transcript: z.boolean().default(true),
    notify: z.boolean().default(true),
  }),
};

// ===========================
// XP COMMAND SCHEMAS
// ===========================

export const XpSchemas = {
  rank: z.object({
    user: CommonSchemas.snowflake.optional(),
  }),
  
  leaderboard: z.object({
    page: z.number()
      .int()
      .min(1)
      .max(100)
      .default(1),
    type: z.enum(['level', 'xp', 'messages', 'voice'])
      .default('level'),
  }),
  
  configuration: z.object({}), // View only, no params
  
  card: z.object({
    background: CommonSchemas.hexColor.optional(),
    progressBar: CommonSchemas.hexColor.optional(),
    textColor: CommonSchemas.hexColor.optional(),
    opacity: z.number()
      .min(0)
      .max(100)
      .optional(),
    backgroundUrl: CommonSchemas.safeUrl.optional(),
  }),
};

// ===========================
// LANGUAGE COMMAND SCHEMAS
// ===========================

export const LanguageSchemas = {
  available: z.object({}), // No params
  
  current: z.object({}), // No params
  
  set: z.object({
    language: CommonSchemas.language,
    scope: z.enum(['user', 'server']).default('user'),
  }),
};

// ===========================
// UTILITY COMMAND SCHEMAS
// ===========================

export const UtilitySchemas = {
  avatar: z.object({
    user: CommonSchemas.snowflake.optional(),
    format: z.enum(['png', 'jpg', 'webp', 'gif']).default('png'),
    size: z.enum(['16', '32', '64', '128', '256', '512', '1024', '2048', '4096'])
      .default('1024'),
  }),
  
  banner: z.object({
    user: CommonSchemas.snowflake.optional(),
  }),
  
  steam: z.object({
    query: z.string()
      .min(1, 'Search query required')
      .max(100, 'Query too long'),
    type: z.enum(['game', 'user', 'news']).default('game'),
  }),
  
  userinfo: z.object({
    user: CommonSchemas.snowflake.optional(),
  }),
  
  whois: z.object({
    user: CommonSchemas.snowflake,
  }),
  
  roleinfo: z.object({
    role: CommonSchemas.snowflake,
  }),
  
  serverinfo: z.object({}), // No params
  
  help: z.object({
    command: z.string()
      .max(50)
      .optional(),
  }),
  
  support: z.object({}), // No params
};

// ===========================
// BLACKLIST COMMAND SCHEMAS
// ===========================

export const BlacklistSchemas = {
  user: z.object({
    user: CommonSchemas.snowflake,
    reason: z.string()
      .min(1, 'Reason is required')
      .max(500, 'Reason too long'),
    duration: CommonSchemas.duration.optional(),
  }),
  
  view: z.object({
    type: z.enum(['users', 'guilds']).default('users'),
    page: z.number()
      .int()
      .min(1)
      .max(100)
      .default(1),
  }),
  
  remove: z.object({
    id: CommonSchemas.snowflake,
    type: z.enum(['user', 'guild']).default('user'),
  }),
};

// ===========================
// MASTER COMMAND SCHEMAS MAP
// ===========================

export const CommandValidationSchemas = {
  warn: WarnSchemas,
  moderation: ModerationSchemas,
  gw: GiveawaySchemas,
  eco: EconomySchemas,
  economy: EconomySchemas,
  config: ConfigSchemas,
  ticket: TicketSchemas,
  xp: XpSchemas,
  language: LanguageSchemas,
  utils: UtilitySchemas,
  blacklist: BlacklistSchemas,
};

// ===========================
// VALIDATION UTILITIES
// ===========================

export class SchemaValidator {
  /**
   * Validates command input against schema
   */
  static validateCommand(
    commandName: string,
    subcommand: string | null,
    data: unknown
  ): { success: boolean; data?: any; error?: string } {
    try {
      const schemas = CommandValidationSchemas[commandName as keyof typeof CommandValidationSchemas];
      if (!schemas) {
        return { success: true }; // No schema defined, allow
      }
      
      const schema = subcommand 
        ? schemas[subcommand as keyof typeof schemas]
        : schemas['default' as keyof typeof schemas];
      
      if (!schema) {
        return { success: true }; // No schema for this subcommand
      }
      
      const result = (schema as any).safeParse(data);
      
      if (result.success) {
        return { success: true, data: result.data };
      } else {
        const errors = result.error.errors
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        return { success: false, error: errors };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Validation failed' 
      };
    }
  }
  
  /**
   * Sanitizes and validates user input
   */
  static sanitizeInput(input: string, maxLength = 2000): string {
    // Remove zero-width characters
    let sanitized = input.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // Remove potential script tags
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
    
    // Escape HTML entities
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
    
    // Truncate if needed
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength - 3) + '...';
    }
    
    return sanitized;
  }
  
  /**
   * Validates batch operations
   */
  static validateBatch<T>(
    items: unknown[],
    schema: z.ZodSchema<T>,
    maxItems = 100
  ): { valid: T[]; invalid: { index: number; error: string }[] } {
    if (items.length > maxItems) {
      throw new Error(`Batch size exceeds maximum of ${maxItems} items`);
    }
    
    const valid: T[] = [];
    const invalid: { index: number; error: string }[] = [];
    
    items.forEach((item, index) => {
      const result = schema.safeParse(item);
      if (result.success) {
        valid.push(result.data);
      } else {
        invalid.push({
          index,
          error: result.error.errors[0]?.message || 'Validation failed',
        });
      }
    });
    
    return { valid, invalid };
  }
}

// Export validation error class
export class CommandValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: unknown
  ) {
    super(message);
    this.name = 'CommandValidationError';
  }
}