import { escapeMarkdown } from 'discord.js';

/**
 * Sanitization utilities for Discord content
 */
export class Sanitizer {
  // Prevent mass mentions
  private static readonly MASS_MENTION_THRESHOLD = 5;

  // Dangerous patterns
  private static readonly DANGEROUS_PATTERNS = {
    // Zero-width characters that can be abused
    zeroWidth: /[\u200B-\u200D\uFEFF\u2060]/g,
    // Discord tokens (partial pattern for safety)
    token: /[\w-]{24}\.[\w-]{6}\.[\w-]{27}/g,
    // Webhook URLs
    webhook: /discord\.com\/api\/webhooks\/\d+\/[\w-]+/gi,
    // IP addresses
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    // Invite links
    invite: /(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[\w-]+/gi,
  };

  /**
   * Sanitize text for safe Discord output
   */
  static sanitizeText(
    text: string,
    options: {
      escapeMentions?: boolean;
      escapeMarkdown?: boolean;
      escapeLinks?: boolean;
      removeZeroWidth?: boolean;
      maxLength?: number;
    } = {}
  ): string {
    if (!text) return '';

    let sanitized = text;

    // Remove zero-width characters
    if (options.removeZeroWidth !== false) {
      sanitized = sanitized.replace(this.DANGEROUS_PATTERNS.zeroWidth, '');
    }

    // Escape Discord markdown
    if (options.escapeMarkdown !== false) {
      sanitized = escapeMarkdown(sanitized);
    }

    // Escape mentions
    if (options.escapeMentions !== false) {
      sanitized = this.escapeMentions(sanitized);
    }

    // Escape links
    if (options.escapeLinks) {
      sanitized = this.escapeLinks(sanitized);
    }

    // Truncate if needed
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = `${sanitized.substring(0, options.maxLength - 3)}...`;
    }

    return sanitized;
  }

  /**
   * Escape all mentions to prevent pings
   */
  static escapeMentions(text: string): string {
    return text
      .replace(/@everyone/g, '@\u200Beveryone')
      .replace(/@here/g, '@\u200Bhere')
      .replace(/<@!?(\d+)>/g, '<@\u200B$1>') // User mentions
      .replace(/<@&(\d+)>/g, '<@\u200B&$1>') // Role mentions
      .replace(/<#(\d+)>/g, '<#\u200B$1>'); // Channel mentions
  }

  /**
   * Escape links to prevent embeds
   */
  static escapeLinks(text: string): string {
    return text.replace(/(https?:\/\/[^\s]+)/g, '<$1>');
  }

  /**
   * Check for mass mentions
   */
  static hasMassMentions(text: string): boolean {
    const mentionCount =
      (text.match(/<@!?\d+>/g) || []).length +
      (text.match(/<@&\d+>/g) || []).length +
      (text.includes('@everyone') ? 10 : 0) +
      (text.includes('@here') ? 5 : 0);

    return mentionCount > this.MASS_MENTION_THRESHOLD;
  }

  /**
   * Remove sensitive information
   */
  static removeSensitive(text: string): string {
    return text
      .replace(this.DANGEROUS_PATTERNS.token, '[TOKEN_REMOVED]')
      .replace(this.DANGEROUS_PATTERNS.webhook, '[WEBHOOK_REMOVED]')
      .replace(this.DANGEROUS_PATTERNS.ipAddress, '[IP_REMOVED]');
  }

  /**
   * Sanitize code block content
   */
  static sanitizeCodeBlock(code: string, language?: string): string {
    // Remove backticks that could break out of code block
    const sanitized = code.replace(/```/g, '\\`\\`\\`');

    // Validate language identifier
    const validLanguages = [
      'js',
      'javascript',
      'ts',
      'typescript',
      'py',
      'python',
      'java',
      'c',
      'cpp',
      'cs',
      'php',
      'rb',
      'go',
      'rs',
      'swift',
      'kotlin',
      'scala',
      'r',
      'sql',
      'bash',
      'sh',
      'powershell',
      'json',
      'yaml',
      'xml',
      'html',
      'css',
      'markdown',
      'md',
      'diff',
      'ini',
      'toml',
    ];

    const lang =
      language && validLanguages.includes(language.toLowerCase()) ? language.toLowerCase() : '';

    return `\`\`\`${lang}\n${sanitized}\n\`\`\``;
  }

  /**
   * Sanitize embed content
   */
  static sanitizeEmbed(embed: {
    title?: string;
    description?: string;
    fields?: Array<{ name: string; value: string }>;
    footer?: { text: string };
    author?: { name: string };
  }): typeof embed {
    const sanitized = { ...embed };

    if (sanitized.title) {
      sanitized.title = this.sanitizeText(sanitized.title, { maxLength: 256 });
    }

    if (sanitized.description) {
      sanitized.description = this.sanitizeText(sanitized.description, { maxLength: 4096 });
    }

    if (sanitized.fields) {
      sanitized.fields = sanitized.fields.map(field => ({
        name: this.sanitizeText(field.name, { maxLength: 256 }),
        value: this.sanitizeText(field.value, { maxLength: 1024 }),
      }));
    }

    if (sanitized.footer?.text) {
      sanitized.footer.text = this.sanitizeText(sanitized.footer.text, { maxLength: 2048 });
    }

    if (sanitized.author?.name) {
      sanitized.author.name = this.sanitizeText(sanitized.author.name, { maxLength: 256 });
    }

    return sanitized;
  }

  /**
   * Sanitize filename
   */
  static sanitizeFilename(filename: string): string {
    // Remove path traversal attempts
    let safe = filename.replace(/[\/\\]/g, '_');

    // Remove special characters
    safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Remove multiple dots (prevent extension spoofing)
    safe = safe.replace(/\.{2,}/g, '.');

    // Limit length
    if (safe.length > 255) {
      const ext = safe.split('.').pop() || '';
      safe = `${safe.substring(0, 250 - ext.length)}.${ext}`;
    }

    return safe || 'unnamed';
  }

  /**
   * Check if text contains spam patterns
   */
  static isSpam(text: string): boolean {
    // Check for excessive caps
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (text.length > 10 && capsRatio > 0.7) {
      return true;
    }

    // Check for repeated characters
    if (/(.)\1{9,}/.test(text)) {
      return true;
    }

    // Check for repeated words
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length > 5 && uniqueWords.size < words.length * 0.3) {
      return true;
    }

    // Check for Discord invite spam
    const inviteCount = (text.match(this.DANGEROUS_PATTERNS.invite) || []).length;
    if (inviteCount > 2) {
      return true;
    }

    return false;
  }

  /**
   * Create a safe preview of text
   */
  static createPreview(text: string, maxLength: number = 100): string {
    const sanitized = this.sanitizeText(text, {
      escapeMentions: true,
      escapeMarkdown: true,
      removeZeroWidth: true,
    });

    if (sanitized.length <= maxLength) {
      return sanitized;
    }

    // Try to cut at word boundary
    const cut = sanitized.lastIndexOf(' ', maxLength);
    const preview = sanitized.substring(0, cut > 0 ? cut : maxLength);

    return `${preview}...`;
  }

  /**
   * Validate and sanitize URL
   */
  static sanitizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url);

      // Only allow http(s)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }

      // Remove auth info
      parsed.username = '';
      parsed.password = '';

      // Remove dangerous characters from pathname
      parsed.pathname = parsed.pathname.replace(/[<>"']/g, '');

      return parsed.toString();
    } catch {
      return null;
    }
  }
}
