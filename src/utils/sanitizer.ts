import { escapeMarkdown } from 'discord.js';
import DOMPurify from 'isomorphic-dompurify';
import { logger } from './logger';

// ===========================
// ENHANCED SANITIZER CLASS
// ===========================

export class EnhancedSanitizer {
  // Security patterns
  private static readonly PATTERNS = {
    // Discord tokens (full pattern)
    discordToken: /[\w-]{24}\.[\w-]{6}\.[\w-]{27,}/g,

    // Webhook URLs
    webhook: /discord(?:app)?\.com\/api\/webhooks\/\d{17,19}\/[\w-]+/gi,

    // API keys (generic patterns)
    apiKey: /(?:api[_-]?key|apikey|api_secret|secret_key)[\s:=]+["']?[\w-]{20,}/gi,

    // Private keys
    privateKey:
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----/g,

    // IP addresses (v4 and v6)
    ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    ipv6: /\b(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}\b/gi,

    // Email addresses
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

    // Phone numbers (US format)
    phone: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,

    // Credit card numbers
    creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,

    // Social Security Numbers
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

    // Discord invites
    discordInvite: /(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[\w-]+/gi,

    // URLs (for validation)
    url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,

    // Suspicious patterns
    zeroWidth: /[\u200B-\u200D\uFEFF\u2060\u180E]/g,
    rtlOverride: /[\u202A-\u202E\u2066-\u2069]/g,

    // XSS patterns
    scriptTag: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    onEvent: /\bon\w+\s*=\s*["'][^"']*["']/gi,
    javascript: /javascript:/gi,
    dataUri: /data:(?!image\/(?:png|jpg|jpeg|gif|webp|svg\+xml))/gi,

    // SQL injection patterns
    sqlKeywords:
      /\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|eval)\b/gi,

    // Command injection patterns
    shellChars: /[;&|`$(){}[\]<>]/g,

    // Path traversal
    pathTraversal: /\.\.\/|\.\.\\|\.\./g,
  };

  // Blocked domains for URL filtering
  private static readonly BLOCKED_DOMAINS = [
    // URL shorteners
    'bit.ly',
    'tinyurl.com',
    'goo.gl',
    'ow.ly',
    't.co',
    'short.link',

    // IP loggers
    'grabify.link',
    'iplogger.org',
    'iplogger.com',
    'iplogger.ru',
    '2no.co',
    'yip.su',
    'blasze.tk',
    'blasze.com',
    'curiouscat.club',

    // Phishing
    'discord-nitro.com',
    'discord-gift.com',
    'discord-gifts.com',
    'discordgift.site',
    'discordgifts.site',
    'discord-airdrop.com',

    // Malware
    'adf.ly',
    'cur.lv',
    'zipansion.com',
    'adfoc.us',
  ];

  // Mass mention thresholds
  private static readonly MENTION_LIMITS = {
    users: 5,
    roles: 3,
    everyone: 1,
    total: 10,
  };

  /**
   * Comprehensive input sanitization
   */
  static sanitize(input: string, options: SanitizationOptions = {}): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Apply length limit first
    if (options.maxLength) {
      sanitized = this.truncate(sanitized, options.maxLength);
    }

    // Remove dangerous Unicode characters
    if (options.removeUnicode !== false) {
      sanitized = this.removeUnsafeUnicode(sanitized);
    }

    // Remove sensitive data
    if (options.removeSensitive !== false) {
      sanitized = this.removeSensitiveData(sanitized);
    }

    // Escape HTML/XSS
    if (options.escapeHtml !== false) {
      sanitized = this.escapeHtml(sanitized);
    }

    // Escape Discord markdown
    if (options.escapeMarkdown) {
      sanitized = escapeMarkdown(sanitized);
    }

    // Escape mentions
    if (options.escapeMentions !== false) {
      sanitized = this.escapeMentions(sanitized);
    }

    // Filter URLs
    if (options.filterUrls) {
      sanitized = this.filterUrls(sanitized);
    }

    // Remove SQL injection attempts
    if (options.preventSql) {
      sanitized = this.preventSqlInjection(sanitized);
    }

    // Remove command injection attempts
    if (options.preventCommand) {
      sanitized = this.preventCommandInjection(sanitized);
    }

    // Normalize whitespace
    if (options.normalizeWhitespace) {
      sanitized = this.normalizeWhitespace(sanitized);
    }

    return sanitized;
  }

  /**
   * Remove unsafe Unicode characters
   */
  private static removeUnsafeUnicode(text: string): string {
    return text
      .replace(this.PATTERNS.zeroWidth, '') // Remove zero-width characters
      .replace(this.PATTERNS.rtlOverride, '') // Remove RTL override characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Remove control characters
  }

  /**
   * Remove sensitive data patterns
   */
  private static removeSensitiveData(text: string): string {
    return text
      .replace(this.PATTERNS.discordToken, '[TOKEN_REMOVED]')
      .replace(this.PATTERNS.webhook, '[WEBHOOK_REMOVED]')
      .replace(this.PATTERNS.apiKey, '[API_KEY_REMOVED]')
      .replace(this.PATTERNS.privateKey, '[PRIVATE_KEY_REMOVED]')
      .replace(this.PATTERNS.creditCard, '[CC_REMOVED]')
      .replace(this.PATTERNS.ssn, '[SSN_REMOVED]')
      .replace(this.PATTERNS.email, match => {
        // Partially mask email
        const [local, domain] = match.split('@');
        return `${local[0]}***@${domain}`;
      })
      .replace(this.PATTERNS.phone, '[PHONE_REMOVED]')
      .replace(this.PATTERNS.ipv4, '[IP_REMOVED]')
      .replace(this.PATTERNS.ipv6, '[IP_REMOVED]');
  }

  /**
   * Escape HTML entities to prevent XSS
   */
  private static escapeHtml(text: string): string {
    // Use DOMPurify for comprehensive XSS protection
    const clean = DOMPurify.sanitize(text, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });

    // Additional escaping
    return clean
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Escape Discord mentions
   */
  private static escapeMentions(text: string): string {
    return text
      .replace(/@everyone/gi, '@\u200Beveryone')
      .replace(/@here/gi, '@\u200Bhere')
      .replace(/<@!?(\d{17,19})>/g, '\\<@$1\\>') // User mentions
      .replace(/<@&(\d{17,19})>/g, '\\<@&$1\\>') // Role mentions
      .replace(/<#(\d{17,19})>/g, '\\<#$1\\>'); // Channel mentions
  }

  /**
   * Filter and validate URLs
   */
  private static filterUrls(text: string): string {
    return text.replace(this.PATTERNS.url, match => {
      try {
        const url = new URL(match);

        // Check against blocked domains
        if (this.BLOCKED_DOMAINS.some(domain => url.hostname.includes(domain))) {
          return '[BLOCKED_URL]';
        }

        // Check for suspicious URLs
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return '[SUSPICIOUS_URL]';
        }

        // Check for data URIs (except safe images)
        if (match.match(this.PATTERNS.dataUri)) {
          return '[DATA_URI_BLOCKED]';
        }

        // Escape the URL to prevent embeds
        return `<${match}>`;
      } catch {
        // Invalid URL
        return '[INVALID_URL]';
      }
    });
  }

  /**
   * Prevent SQL injection attempts
   */
  private static preventSqlInjection(text: string): string {
    // Check for SQL keywords in suspicious contexts
    const hasSqlPattern =
      this.PATTERNS.sqlKeywords.test(text) &&
      (text.includes(';') || text.includes('--') || text.includes('/*'));

    if (hasSqlPattern) {
      logger.warn(`Potential SQL injection attempt detected: ${text.substring(0, 50)}...`);
      // Replace SQL keywords
      return text.replace(this.PATTERNS.sqlKeywords, match => `[${match.toUpperCase()}_BLOCKED]`);
    }

    return text;
  }

  /**
   * Prevent command injection attempts
   */
  private static preventCommandInjection(text: string): string {
    // Check for shell metacharacters
    if (this.PATTERNS.shellChars.test(text)) {
      // Escape shell metacharacters
      return text.replace(this.PATTERNS.shellChars, char => `\\${char}`);
    }

    return text;
  }

  /**
   * Normalize whitespace
   */
  private static normalizeWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .trim(); // Remove leading/trailing whitespace
  }

  /**
   * Truncate text safely
   */
  private static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Try to break at word boundary
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Check for mass mentions
   */
  static hasMassMentions(text: string): MassMentionCheck {
    const userMentions = (text.match(/<@!?\d{17,19}>/g) || []).length;
    const roleMentions = (text.match(/<@&\d{17,19}>/g) || []).length;
    const everyoneMentions = (text.match(/@everyone/gi) || []).length;
    const hereMentions = (text.match(/@here/gi) || []).length;

    const total = userMentions + roleMentions + everyoneMentions * 10 + hereMentions * 5;

    return {
      detected:
        userMentions > this.MENTION_LIMITS.users ||
        roleMentions > this.MENTION_LIMITS.roles ||
        everyoneMentions > 0 ||
        total > this.MENTION_LIMITS.total,
      counts: {
        users: userMentions,
        roles: roleMentions,
        everyone: everyoneMentions,
        here: hereMentions,
        total,
      },
    };
  }

  /**
   * Check for spam patterns
   */
  static isSpam(text: string): SpamCheck {
    const checks = {
      repeatedChars: /(.)\1{9,}/.test(text),
      excessiveCaps: text.length > 10 && (text.match(/[A-Z]/g) || []).length / text.length > 0.7,
      repeatedWords: /\b(\w+)\b(?:\s+\1){4,}/.test(text),
      excessiveEmojis: (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length > 20,
      excessiveLinks: (text.match(this.PATTERNS.url) || []).length > 5,
      suspiciousPatterns:
        /(?:free|win|claim|nitro|gift|prize)/gi.test(text) && this.PATTERNS.url.test(text),
    };

    const score = Object.values(checks).filter(Boolean).length;

    return {
      isSpam: score >= 2,
      score,
      reasons: Object.entries(checks)
        .filter(([_, value]) => value)
        .map(([key]) => key),
    };
  }

  /**
   * Validate and sanitize filenames
   */
  static sanitizeFilename(filename: string): string {
    // Remove path traversal attempts
    let safe = filename.replace(this.PATTERNS.pathTraversal, '');

    // Remove dangerous characters
    safe = safe.replace(/[<>:"|?*]/g, '_');

    // Remove control characters
    safe = safe.replace(/[\x00-\x1f\x80-\x9f]/g, '');

    // Limit length
    if (safe.length > 255) {
      const ext = safe.substring(safe.lastIndexOf('.'));
      safe = safe.substring(0, 255 - ext.length) + ext;
    }

    // Ensure it's not a reserved name (Windows)
    const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
    const nameWithoutExt = safe.substring(0, safe.lastIndexOf('.') || safe.length);
    if (reserved.includes(nameWithoutExt.toUpperCase())) {
      safe = `_${safe}`;
    }

    return safe || 'unnamed';
  }

  /**
   * Validate file safety
   */
  static isFileSafe(filename: string, mimeType?: string, size?: number): FileSafetyCheck {
    const issues: string[] = [];

    // Check filename
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
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
      '.dmg',
      '.pkg',
      '.run',
    ];

    if (dangerousExtensions.includes(ext)) {
      issues.push(`Dangerous file extension: ${ext}`);
    }

    // Check MIME type
    if (mimeType) {
      const dangerousMimes = [
        'application/x-executable',
        'application/x-sharedlib',
        'application/x-msdownload',
        'application/x-msi',
        'application/x-sh',
        'application/x-batch',
      ];

      if (dangerousMimes.includes(mimeType)) {
        issues.push(`Dangerous MIME type: ${mimeType}`);
      }
    }

    // Check file size
    if (size) {
      const maxSize = 8 * 1024 * 1024; // 8MB
      if (size > maxSize) {
        issues.push(`File too large: ${(size / 1024 / 1024).toFixed(2)}MB`);
      }

      if (size === 0) {
        issues.push('Empty file');
      }
    }

    // Check for double extensions
    if ((filename.match(/\./g) || []).length > 1) {
      const parts = filename.split('.');
      if (parts.length > 2 && dangerousExtensions.includes(`.${parts[parts.length - 2]}`)) {
        issues.push('Double extension detected');
      }
    }

    return {
      safe: issues.length === 0,
      issues,
    };
  }
}

// ===========================
// TYPE DEFINITIONS
// ===========================

export interface SanitizationOptions {
  maxLength?: number;
  removeUnicode?: boolean;
  removeSensitive?: boolean;
  escapeHtml?: boolean;
  escapeMarkdown?: boolean;
  escapeMentions?: boolean;
  filterUrls?: boolean;
  preventSql?: boolean;
  preventCommand?: boolean;
  normalizeWhitespace?: boolean;
}

export interface MassMentionCheck {
  detected: boolean;
  counts: {
    users: number;
    roles: number;
    everyone: number;
    here: number;
    total: number;
  };
}

export interface SpamCheck {
  isSpam: boolean;
  score: number;
  reasons: string[];
}

export interface FileSafetyCheck {
  safe: boolean;
  issues: string[];
}

// ===========================
// CONVENIENCE FUNCTIONS
// ===========================

/**
 * Quick sanitization for user input
 */
export function sanitizeUserInput(input: string, maxLength = 2000): string {
  return EnhancedSanitizer.sanitize(input, {
    maxLength,
    removeSensitive: true,
    escapeHtml: true,
    escapeMentions: true,
    filterUrls: true,
    normalizeWhitespace: true,
  });
}

/**
 * Sanitize for database storage
 */
export function sanitizeForDatabase(input: string): string {
  return EnhancedSanitizer.sanitize(input, {
    removeSensitive: true,
    preventSql: true,
    escapeHtml: true,
  });
}

/**
 * Sanitize for Discord output
 */
export function sanitizeForDiscord(input: string): string {
  return EnhancedSanitizer.sanitize(input, {
    escapeMentions: true,
    escapeMarkdown: false,
    filterUrls: true,
    maxLength: 2000,
  });
}

/**
 * Sanitize command arguments
 */
export function sanitizeCommandArgs(input: string): string {
  return EnhancedSanitizer.sanitize(input, {
    preventCommand: true,
    preventSql: true,
    removeUnicode: true,
    normalizeWhitespace: true,
  });
}

// Export main class as default
export default EnhancedSanitizer;
