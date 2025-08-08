import { z } from 'zod';

// Common validation schemas
export const ValidationSchemas = {
  // Discord IDs
  snowflake: z.string().regex(/^\d{17,19}$/, 'Invalid Discord ID'),

  // User input strings
  username: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, 'Invalid username format'),
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(4000).trim().optional(),
  shortText: z.string().max(1000).trim(),

  // Numbers
  level: z.number().int().min(1).max(10),
  amount: z.number().int().min(0).max(1000000000), // Max 1 billion
  percentage: z.number().min(0).max(100),

  // Time
  duration: z.number().int().min(1).max(31536000), // Max 1 year in seconds
  timestamp: z.date().or(z.number().int().positive()),

  // Arrays with limits
  snowflakeArray: z.array(z.string().regex(/^\d{17,19}$/)).max(100),
  stringArray: z.array(z.string().max(255)).max(50),

  // File validation
  attachment: z.object({
    url: z.string().url(),
    name: z.string().max(255),
    size: z.number().max(8388608), // 8MB max
    contentType: z.string().optional(),
  }),

  // Pagination
  page: z.number().int().min(1).max(1000).default(1),
  limit: z.number().int().min(1).max(100).default(10),
};

// Command-specific validation schemas
export const CommandSchemas = {
  warn: {
    create: z.object({
      userId: ValidationSchemas.snowflake,
      title: ValidationSchemas.title,
      description: ValidationSchemas.description.optional(),
      level: ValidationSchemas.level.optional().default(1),
      proof: ValidationSchemas.attachment.optional(),
    }),

    edit: z.object({
      warnId: z.string().uuid(),
      title: ValidationSchemas.title,
      description: ValidationSchemas.description,
    }),

    automation: z.object({
      name: ValidationSchemas.title,
      description: ValidationSchemas.description,
      triggerType: z.enum(['warn_count', 'warn_level']),
      triggerValue: z.number().int().min(1).max(100),
      actions: z
        .array(
          z.object({
            type: z.enum(['ban', 'kick', 'timeout', 'role', 'message']),
            duration: z.number().optional(),
            roleId: ValidationSchemas.snowflake.optional(),
            message: z.string().max(2000).optional(),
          })
        )
        .min(1)
        .max(5),
    }),
  },

  economy: {
    balance: z.object({
      userId: ValidationSchemas.snowflake.optional(),
    }),

    gamble: z.object({
      amount: ValidationSchemas.amount.min(1),
      game: z.enum(['dice', 'coinflip', 'slots', 'blackjack', 'roulette']),
    }),

    shop: z.object({
      action: z.enum(['view', 'buy']),
      itemId: z.string().uuid().optional(),
      quantity: z.number().int().min(1).max(99).default(1),
    }),

    rob: z.object({
      userId: ValidationSchemas.snowflake,
    }),
  },

  moderation: {
    ban: z.object({
      userId: ValidationSchemas.snowflake,
      reason: ValidationSchemas.description.optional(),
      duration: ValidationSchemas.duration.optional(),
      deleteMessages: z.boolean().optional().default(false),
    }),

    kick: z.object({
      userId: ValidationSchemas.snowflake,
      reason: ValidationSchemas.description.optional(),
    }),

    timeout: z.object({
      userId: ValidationSchemas.snowflake,
      duration: ValidationSchemas.duration,
      reason: ValidationSchemas.description.optional(),
    }),
    
    'reset-xp': z.object({
      userId: ValidationSchemas.snowflake,
    }),
  },

  giveaway: {
    start: z.object({
      title: ValidationSchemas.title,
      description: ValidationSchemas.description,
      prize: ValidationSchemas.title,
      duration: ValidationSchemas.duration,
      winnerCount: z.number().int().min(1).max(20).default(1),
      requiredRoles: ValidationSchemas.snowflakeArray.optional(),
      blacklistedRoles: ValidationSchemas.snowflakeArray.optional(),
      minLevel: z.number().int().min(0).max(100).optional(),
      bonusEntries: z
        .array(
          z.object({
            roleId: ValidationSchemas.snowflake,
            entries: z.number().int().min(1).max(10),
          })
        )
        .max(10)
        .optional(),
    }),

    end: z.object({
      giveawayId: z.string().uuid(),
      force: z.boolean().default(false),
    }),

    reroll: z.object({
      giveawayId: z.string().uuid(),
      winnerCount: z.number().int().min(1).max(20).optional(),
    }),
  },

  ticket: {
    panel: z.object({
      title: ValidationSchemas.title,
      description: ValidationSchemas.description,
      category: ValidationSchemas.snowflake,
      supportRoles: ValidationSchemas.snowflakeArray.min(1),
      mentionRoles: z.boolean().default(true),
      requireReason: z.boolean().default(true),
      autoClose: z.number().int().min(0).max(604800).optional(), // Max 7 days
    }),

    close: z.object({
      reason: ValidationSchemas.description,
      transcript: z.boolean().default(true),
    }),
  },

  config: {
    language: z.object({
      language: z.enum(['en', 'de', 'es', 'fr']),
    }),

    xp: z.object({
      enabled: z.boolean(),
      messageXp: z.object({
        min: z.number().int().min(0).max(100),
        max: z.number().int().min(0).max(100),
      }),
      voiceXp: z.number().int().min(0).max(100),
      cooldown: z.number().int().min(0).max(300),
      multipliers: z
        .array(
          z.object({
            roleId: ValidationSchemas.snowflake,
            multiplier: z.number().min(0.1).max(10),
          })
        )
        .max(10)
        .optional(),
      rewards: z
        .array(
          z.object({
            level: z.number().int().min(1).max(1000),
            roleId: ValidationSchemas.snowflake,
          })
        )
        .max(50)
        .optional(),
    }),
  },
};

// Validation helper functions
export class Validator {
  /**
   * Validates input against a schema and returns sanitized data
   */
  static validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map(issue => {
            const path = issue.path.join('.');
            return `${path}: ${issue.message}`;
          })
          .join(', ');
        throw new ValidationError(`Validation failed: ${issues}`);
      }
      throw error;
    }
  }

  /**
   * Validates input safely, returning result or null
   */
  static safeParse<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
    const result = schema.safeParse(data);
    return result.success ? result.data : null;
  }

  /**
   * Validates Discord permissions
   */
  static validatePermissions(required: bigint[], userPerms: bigint): boolean {
    return required.every(perm => (userPerms & perm) === perm);
  }

  /**
   * Validates URL safety
   */
  static isUrlSafe(url: string): boolean {
    try {
      const parsed = new URL(url);
      const allowedProtocols = ['http:', 'https:'];
      const blockedDomains = [
        'bit.ly',
        'tinyurl.com',
        'grabify.link',
        'iplogger.org',
        'blasze.tk',
        'curiouscat.club',
        '2no.co',
        'yip.su',
      ];

      if (!allowedProtocols.includes(parsed.protocol)) {
        return false;
      }

      const domain = parsed.hostname.toLowerCase();
      return !blockedDomains.some(blocked => domain.includes(blocked));
    } catch {
      return false;
    }
  }

  /**
   * Validates file type safety
   */
  static isFileSafe(filename: string, mimeType?: string): boolean {
    const dangerousExtensions = [
      '.exe',
      '.scr',
      '.vbs',
      '.js',
      '.jar',
      '.bat',
      '.cmd',
      '.com',
      '.pif',
      '.msi',
      '.app',
      '.deb',
      '.rpm',
    ];

    const lowerName = filename.toLowerCase();
    if (dangerousExtensions.some(ext => lowerName.endsWith(ext))) {
      return false;
    }

    if (mimeType) {
      const dangerousMimes = [
        'application/x-executable',
        'application/x-sharedlib',
        'application/x-msdownload',
      ];
      return !dangerousMimes.includes(mimeType);
    }

    return true;
  }

  /**
   * Validates regex pattern safety (prevents ReDoS)
   */
  static isRegexSafe(pattern: string, maxLength: number = 100): boolean {
    if (pattern.length > maxLength) {
      return false;
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /(\w+\+)+/, // Nested quantifiers
      /(\S+\*)+/, // Nested quantifiers
      /(a+)+b/, // Catastrophic backtracking
      /(\d+)+\w/, // Nested quantifiers with digits
    ];

    return !dangerousPatterns.some(dangerous => pattern.match(dangerous));
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
