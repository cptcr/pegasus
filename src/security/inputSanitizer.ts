import { z } from 'zod';
import { logger } from '../utils/logger';
import { createHash, randomBytes } from 'crypto';

/**
 * Comprehensive input sanitization and validation utilities
 */
export class InputSanitizer {
  // Enhanced validation schemas with strict rules
  static readonly schemas = {
    // Discord IDs (Snowflakes)
    discordId: z.string()
      .regex(/^\d{17,19}$/)
      .refine(val => {
        const num = BigInt(val);
        return num >= 0n && num <= 9223372036854775807n; // Valid snowflake range
      }, 'Invalid Discord ID'),
    
    // User inputs
    username: z.string()
      .min(1)
      .max(32)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
      .transform(val => val.trim()),
    
    // Text inputs with sanitization
    shortText: z.string()
      .min(1)
      .max(100)
      .transform(val => InputSanitizer.sanitizeText(val))
      .refine(val => !InputSanitizer.containsMaliciousPatterns(val), 'Invalid input detected'),
    
    mediumText: z.string()
      .min(1)
      .max(1024)
      .transform(val => InputSanitizer.sanitizeText(val))
      .refine(val => !InputSanitizer.containsMaliciousPatterns(val), 'Invalid input detected'),
    
    longText: z.string()
      .min(1)
      .max(4096)
      .transform(val => InputSanitizer.sanitizeText(val))
      .refine(val => !InputSanitizer.containsMaliciousPatterns(val), 'Invalid input detected'),
    
    // Command-specific inputs
    reason: z.string()
      .max(512)
      .optional()
      .transform(val => val ? InputSanitizer.sanitizeText(val) : undefined),
    
    duration: z.string()
      .regex(/^\d+[smhdwMy]$/, 'Invalid duration format')
      .refine(val => {
        const num = parseInt(val);
        const unit = val.slice(-1);
        const maxValues: Record<string, number> = {
          's': 31536000, // 1 year in seconds
          'm': 525600,   // 1 year in minutes
          'h': 8760,     // 1 year in hours
          'd': 365,      // 1 year in days
          'w': 52,       // 1 year in weeks
          'M': 12,       // 1 year in months
          'y': 1         // 1 year
        };
        return num <= maxValues[unit];
      }, 'Duration too long'),
    
    amount: z.number()
      .int()
      .positive()
      .max(1000000000)
      .refine(val => Number.isSafeInteger(val), 'Amount too large'),
    
    // URL validation with additional security checks
    url: z.string()
      .url()
      .refine(val => InputSanitizer.isSafeURL(val), 'Unsafe URL detected'),
    
    // Email with privacy protection
    email: z.string()
      .email()
      .transform(val => val.toLowerCase().trim()),
    
    // Color validation
    hexColor: z.string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
    
    // Array validations with limits
    idArray: z.array(z.string().regex(/^\d{17,19}$/))
      .max(25)
      .refine(arr => new Set(arr).size === arr.length, 'Duplicate IDs not allowed'),
    
    stringArray: z.array(z.string().max(100))
      .max(25)
      .transform(arr => arr.map(s => InputSanitizer.sanitizeText(s))),
    
    // JSON validation
    jsonData: z.string()
      .refine(val => {
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      }, 'Invalid JSON')
      .transform(val => JSON.parse(val))
      .refine(val => !InputSanitizer.containsMaliciousJSON(val), 'Malicious JSON detected'),
  };

  /**
   * Enhanced text sanitization
   */
  static sanitizeText(text: string): string {
    return text
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove control characters except newlines and tabs
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Escape markdown code blocks
      .replace(/```/g, '\\`\\`\\`')
      // Break @everyone and @here mentions
      .replace(/@(everyone|here)/gi, '@\u200b$1')
      // Escape user/role mentions
      .replace(/<@[!&]?\d+>/g, (match) => `\\${match}`)
      // Remove zero-width characters that could be used for exploits
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
      // Limit consecutive characters to prevent spam
      .replace(/(.)\1{9,}/g, '$1$1$1$1$1$1$1$1$1'); // Max 9 consecutive chars
  }

  /**
   * Check for malicious patterns with enhanced detection
   */
  static containsMaliciousPatterns(input: string): boolean {
    const patterns = [
      // SQL Injection patterns (comprehensive)
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*\b(from|where|set|values|into)\b)/gi,
      /(';|";|`|--|\/\*|\*\/|xp_|sp_)/gi,
      /(\bor\b\s*['"0-9]+=\s*['"0-9]+|\band\b\s*['"0-9]+=\s*['"0-9]+)/gi,
      /(\bhaving\b|\bgroup\s+by\b|\border\s+by\b)/gi,
      /(cast\s*\(|convert\s*\(|concat\s*\()/gi,
      
      // NoSQL Injection patterns
      /(\$where|\$regex|\$ne|\$gt|\$lt|\$gte|\$lte)/gi,
      
      // XSS patterns
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      
      // Command injection patterns
      /(\||;|&|\$\(|`)/g,
      /(nc\s+-|bash\s+-|sh\s+-|curl\s+|wget\s+)/gi,
      
      // Path traversal
      /(\.\.\/|\.\.\\)/g,
      
      // Format string attacks
      /%[0-9]*[diouxXeEfFgGaAcspn%]/g,
    ];
    
    return patterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate JSON for malicious content
   */
  static containsMaliciousJSON(obj: any): boolean {
    const check = (value: any): boolean => {
      if (typeof value === 'string') {
        return this.containsMaliciousPatterns(value);
      }
      if (Array.isArray(value)) {
        return value.some(check);
      }
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(check);
      }
      return false;
    };
    
    return check(obj);
  }

  /**
   * Enhanced URL safety check
   */
  static isSafeURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Check protocol
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      
      // Blacklist dangerous domains
      const blacklistedDomains = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '169.254.169.254', // AWS metadata endpoint
      ];
      
      if (blacklistedDomains.includes(parsed.hostname)) {
        return false;
      }
      
      // Check for private IP ranges
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipPattern.test(parsed.hostname)) {
        const octets = parsed.hostname.split('.').map(Number);
        if (
          octets[0] === 10 || // 10.0.0.0/8
          (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || // 172.16.0.0/12
          (octets[0] === 192 && octets[1] === 168) // 192.168.0.0/16
        ) {
          return false;
        }
      }
      
      // Check for suspicious patterns in URL
      const suspiciousPatterns = [
        /javascript:/i,
        /data:text\/html/i,
        /vbscript:/i,
        /file:/i,
        /jar:/i,
      ];
      
      return !suspiciousPatterns.some(pattern => pattern.test(url));
    } catch {
      return false;
    }
  }

  /**
   * Sanitize file paths with strict validation
   */
  static sanitizeFilePath(path: string): string | null {
    // Remove any path traversal attempts
    const sanitized = path
      .replace(/\.\./g, '')
      .replace(/[<>:"|?*]/g, '')
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
    
    // Ensure the path doesn't contain suspicious patterns
    const suspicious = [
      /^\//,           // Absolute paths
      /^[a-zA-Z]:/,    // Windows drive letters
      /\0/,            // Null bytes
      /[^\x20-\x7E]/,  // Non-printable characters
    ];
    
    if (suspicious.some(pattern => pattern.test(sanitized))) {
      return null;
    }
    
    // Limit path depth
    if (sanitized.split('/').length > 10) {
      return null;
    }
    
    return sanitized;
  }

  /**
   * Generate cryptographically secure tokens
   */
  static generateSecureToken(length: number = 32): string {
    return randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  /**
   * Hash sensitive data with salt
   */
  static async hashSensitiveData(data: string, salt?: string): Promise<string> {
    const actualSalt = salt || randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(actualSalt + data)
      .digest('hex');
    
    return `${actualSalt}:${hash}`;
  }

  /**
   * Verify hashed data
   */
  static async verifyHashedData(data: string, hashedValue: string): Promise<boolean> {
    const [salt, hash] = hashedValue.split(':');
    if (!salt || !hash) return false;
    
    const newHash = createHash('sha256')
      .update(salt + data)
      .digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    return hash.length === newHash.length && 
           hash.split('').every((char, i) => char === newHash[i]);
  }

  /**
   * Mask sensitive data for logging
   */
  static maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (data.length <= visibleChars * 2) {
      return '*'.repeat(data.length);
    }
    
    const start = data.slice(0, visibleChars);
    const end = data.slice(-visibleChars);
    const masked = '*'.repeat(Math.max(4, data.length - visibleChars * 2));
    
    return `${start}${masked}${end}`;
  }

  /**
   * Validate Discord webhook URL
   */
  static isValidDiscordWebhook(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && 
             (parsed.hostname === 'discord.com' || 
              parsed.hostname === 'discordapp.com') &&
             parsed.pathname.startsWith('/api/webhooks/');
    } catch {
      return false;
    }
  }

  /**
   * Create rate limit key with normalization
   */
  static createRateLimitKey(userId: string, commandName: string, guildId?: string): string {
    const normalizedCommand = commandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const components = ['ratelimit', userId, normalizedCommand];
    
    if (guildId) {
      components.push(guildId);
    }
    
    return components.join(':');
  }

  /**
   * Validate permission integer
   */
  static validatePermissionInteger(permissions: string | bigint): boolean {
    try {
      const perm = typeof permissions === 'string' ? BigInt(permissions) : permissions;
      // Check if it's within valid Discord permission range
      return perm >= 0n && perm <= (1n << 53n) - 1n;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize embed content
   */
  static sanitizeEmbed(embed: any): any {
    const sanitizeField = (field: any) => ({
      ...field,
      name: field.name ? this.sanitizeText(field.name).slice(0, 256) : '',
      value: field.value ? this.sanitizeText(field.value).slice(0, 1024) : '',
      inline: Boolean(field.inline)
    });

    return {
      title: embed.title ? this.sanitizeText(embed.title).slice(0, 256) : undefined,
      description: embed.description ? this.sanitizeText(embed.description).slice(0, 4096) : undefined,
      url: embed.url && this.isSafeURL(embed.url) ? embed.url : undefined,
      color: embed.color ? Number(embed.color) & 0xFFFFFF : undefined,
      fields: Array.isArray(embed.fields) ? embed.fields.slice(0, 25).map(sanitizeField) : undefined,
      author: embed.author ? {
        name: this.sanitizeText(embed.author.name || '').slice(0, 256),
        icon_url: embed.author.icon_url && this.isSafeURL(embed.author.icon_url) ? embed.author.icon_url : undefined,
        url: embed.author.url && this.isSafeURL(embed.author.url) ? embed.author.url : undefined,
      } : undefined,
      footer: embed.footer ? {
        text: this.sanitizeText(embed.footer.text || '').slice(0, 2048),
        icon_url: embed.footer.icon_url && this.isSafeURL(embed.footer.icon_url) ? embed.footer.icon_url : undefined,
      } : undefined,
      image: embed.image?.url && this.isSafeURL(embed.image.url) ? { url: embed.image.url } : undefined,
      thumbnail: embed.thumbnail?.url && this.isSafeURL(embed.thumbnail.url) ? { url: embed.thumbnail.url } : undefined,
    };
  }
}

/**
 * Decorator for input validation on command methods
 */
export function ValidateInput(schema: z.ZodSchema<any>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const [interaction, ...rest] = args;
      
      try {
        // Extract and validate options
        const options: Record<string, any> = {};
        
        if (interaction.options) {
          interaction.options.data.forEach((opt: any) => {
            options[opt.name] = opt.value;
          });
        }
        
        const validated = schema.parse(options);
        
        // Replace options with validated ones
        if (interaction.options) {
          interaction.options._validated = validated;
        }
        
        return await method.apply(this, args);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = `Invalid input: ${error.errors.map(e => e.message).join(', ')}`;
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: message, ephemeral: true });
          } else {
            await interaction.reply({ content: message, ephemeral: true });
          }
          
          return;
        }
        
        throw error;
      }
    };
    
    return descriptor;
  };
}