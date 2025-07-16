import { Message, GuildMember, TextChannel, PermissionFlagsBits } from 'discord.js';
import { db } from '../database/connection';
import { createEmbed, createErrorEmbed } from '../utils/helpers';
import { colors, emojis } from '../utils/config';
import { loggingHandler } from './logging';

interface AutoModFilter {
  id: string;
  guildId: string;
  type: 'profanity' | 'spam' | 'links' | 'invites' | 'caps' | 'mentions' | 'zalgo' | 'custom';
  enabled: boolean;
  action: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
  threshold?: number;
  duration?: number;
  whitelist: string[];
  blacklist: string[];
  exemptRoles: string[];
  exemptChannels: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface AutoModViolation {
  userId: string;
  guildId: string;
  type: string;
  count: number;
  lastViolation: Date;
}

export class AutoModHandler {
  private static instance: AutoModHandler;
  private violationCounts = new Map<string, AutoModViolation>();
  private spamTracker = new Map<string, { messages: number; lastMessage: number }>();

  // Profanity filter words
  private profanityWords = [
    'badword1', 'badword2', 'badword3' // Add your profanity list here
  ];

  // Spam detection patterns
  private spamPatterns = [
    /(.)\1{10,}/g, // Repeated characters
    /\b(\w+)(\s+\1){3,}/g, // Repeated words
    /[A-Z]{5,}/g, // Excessive caps
  ];

  public static getInstance(): AutoModHandler {
    if (!AutoModHandler.instance) {
      AutoModHandler.instance = new AutoModHandler();
    }
    return AutoModHandler.instance;
  }

  public async handleMessage(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;

    const member = message.member;
    if (!member) return;

    // Check if user is exempt
    if (await this.isExempt(member, message.channel as TextChannel)) return;

    const filters = await this.getActiveFilters(message.guild.id);
    
    for (const filter of filters) {
      if (await this.checkFilter(message, filter)) {
        await this.executeAction(message, filter);
        break; // Only apply first matching filter
      }
    }
  }

  private async checkFilter(message: Message, filter: AutoModFilter): Promise<boolean> {
    const content = message.content.toLowerCase();
    
    switch (filter.type) {
      case 'profanity':
        return this.checkProfanity(content, filter);
      
      case 'spam':
        return this.checkSpam(message, filter);
      
      case 'links':
        return this.checkLinks(content, filter);
      
      case 'invites':
        return this.checkInvites(content, filter);
      
      case 'caps':
        return this.checkCaps(content, filter);
      
      case 'mentions':
        return this.checkMentions(message, filter);
      
      case 'zalgo':
        return this.checkZalgo(content);
      
      case 'custom':
        return this.checkCustom(content, filter);
      
      default:
        return false;
    }
  }

  private checkProfanity(content: string, filter: AutoModFilter): boolean {
    const words = [...this.profanityWords, ...filter.blacklist];
    const whitelist = filter.whitelist;
    
    for (const word of words) {
      if (content.includes(word.toLowerCase())) {
        // Check if whitelisted
        const isWhitelisted = whitelist.some(whiteWord => 
          content.includes(whiteWord.toLowerCase())
        );
        if (!isWhitelisted) {
          return true;
        }
      }
    }
    return false;
  }

  private checkSpam(message: Message, filter: AutoModFilter): boolean {
    const userId = message.author.id;
    const now = Date.now();
    const threshold = filter.threshold || 5;
    
    // Track message frequency
    const userSpam = this.spamTracker.get(userId) || { messages: 0, lastMessage: 0 };
    
    if (now - userSpam.lastMessage < 5000) { // 5 seconds window
      userSpam.messages++;
    } else {
      userSpam.messages = 1;
    }
    
    userSpam.lastMessage = now;
    this.spamTracker.set(userId, userSpam);
    
    // Check for spam patterns
    const content = message.content;
    for (const pattern of this.spamPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }
    
    return userSpam.messages >= threshold;
  }

  private checkLinks(content: string, filter: AutoModFilter): boolean {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const links = content.match(urlRegex);
    
    if (!links) return false;
    
    // Check whitelist
    for (const link of links) {
      const isWhitelisted = filter.whitelist.some(whiteLink => 
        link.includes(whiteLink)
      );
      if (!isWhitelisted) {
        return true;
      }
    }
    
    return false;
  }

  private checkInvites(content: string, filter: AutoModFilter): boolean {
    const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)[a-zA-Z0-9]+/g;
    return inviteRegex.test(content);
  }

  private checkCaps(content: string, filter: AutoModFilter): boolean {
    if (content.length < 10) return false; // Ignore short messages
    
    const capsCount = (content.match(/[A-Z]/g) || []).length;
    const threshold = filter.threshold || 70; // 70% caps
    const capsPercentage = (capsCount / content.length) * 100;
    
    return capsPercentage >= threshold;
  }

  private checkMentions(message: Message, filter: AutoModFilter): boolean {
    const threshold = filter.threshold || 5;
    const totalMentions = message.mentions.users.size + message.mentions.roles.size;
    return totalMentions >= threshold;
  }

  private checkZalgo(content: string): boolean {
    // Check for zalgo text (excessive combining characters)
    const zalgoRegex = /[\u0300-\u036f\u0483-\u0489\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g;
    const zalgoCount = (content.match(zalgoRegex) || []).length;
    return zalgoCount > content.length * 0.3; // 30% threshold
  }

  private checkCustom(content: string, filter: AutoModFilter): boolean {
    for (const blacklisted of filter.blacklist) {
      if (content.includes(blacklisted.toLowerCase())) {
        const isWhitelisted = filter.whitelist.some(whiteWord => 
          content.includes(whiteWord.toLowerCase())
        );
        if (!isWhitelisted) {
          return true;
        }
      }
    }
    return false;
  }

  private async executeAction(message: Message, filter: AutoModFilter): Promise<void> {
    if (!message.guild || !message.member) return;

    try {
      // Delete the message
      if (message.deletable) {
        await message.delete();
      }

      // Track violation
      await this.trackViolation(message.author.id, message.guild.id, filter.type);

      // Log the action
      await loggingHandler.logModerationAction(
        message.guild.id,
        `automod_${filter.type}`,
        message.author,
        message.client.user!,
        `AutoMod: ${filter.type} filter triggered`
      );

      // Execute punishment based on action
      switch (filter.action) {
        case 'warn':
          await this.warnUser(message, filter);
          break;
        
        case 'mute':
          await this.muteUser(message, filter);
          break;
        
        case 'kick':
          await this.kickUser(message, filter);
          break;
        
        case 'ban':
          await this.banUser(message, filter);
          break;
      }

      // Send notification to user
      try {
        const embed = createErrorEmbed(
          'AutoMod Violation',
          `Your message was removed for violating the ${filter.type} filter.\n\n` +
          `**Action taken:** ${filter.action}`
        );
        
        await message.author.send({ embeds: [embed] });
      } catch (error) {
        console.log('Could not send DM to user');
      }

    } catch (error) {
      console.error('Error executing automod action:', error);
    }
  }

  private async warnUser(message: Message, filter: AutoModFilter): Promise<void> {
    if (!message.guild || !message.member) return;

    // Add warning to database
    await db.query(
      `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        message.guild.id,
        message.author.id,
        message.client.user!.id,
        'warn',
        `AutoMod: ${filter.type} filter violation`
      ]
    );

    // Update user profile
    await db.query(
      `UPDATE user_profiles SET warnings = warnings + 1 
       WHERE user_id = $1 AND guild_id = $2`,
      [message.author.id, message.guild.id]
    );
  }

  private async muteUser(message: Message, filter: AutoModFilter): Promise<void> {
    if (!message.guild || !message.member) return;

    const duration = filter.duration || 600000; // 10 minutes default
    const expiresAt = new Date(Date.now() + duration);

    try {
      await message.member.disableCommunicationUntil(
        expiresAt,
        `AutoMod: ${filter.type} filter violation`
      );

      await db.query(
        `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, duration, expires_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          message.guild.id,
          message.author.id,
          message.client.user!.id,
          'mute',
          `AutoMod: ${filter.type} filter violation`,
          duration,
          expiresAt
        ]
      );
    } catch (error) {
      console.error('Error muting user:', error);
    }
  }

  private async kickUser(message: Message, filter: AutoModFilter): Promise<void> {
    if (!message.guild || !message.member) return;

    try {
      await message.member.kick(`AutoMod: ${filter.type} filter violation`);

      await db.query(
        `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          message.guild.id,
          message.author.id,
          message.client.user!.id,
          'kick',
          `AutoMod: ${filter.type} filter violation`
        ]
      );
    } catch (error) {
      console.error('Error kicking user:', error);
    }
  }

  private async banUser(message: Message, filter: AutoModFilter): Promise<void> {
    if (!message.guild || !message.member) return;

    try {
      await message.guild.members.ban(message.author, {
        reason: `AutoMod: ${filter.type} filter violation`
      });

      await db.query(
        `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          message.guild.id,
          message.author.id,
          message.client.user!.id,
          'ban',
          `AutoMod: ${filter.type} filter violation`
        ]
      );
    } catch (error) {
      console.error('Error banning user:', error);
    }
  }

  private async trackViolation(userId: string, guildId: string, type: string): Promise<void> {
    const key = `${userId}-${guildId}-${type}`;
    const violation = this.violationCounts.get(key) || {
      userId,
      guildId,
      type,
      count: 0,
      lastViolation: new Date()
    };

    violation.count++;
    violation.lastViolation = new Date();
    
    this.violationCounts.set(key, violation);

    // Store in database
    await db.query(
      `INSERT INTO automod_violations (user_id, guild_id, violation_type, count, last_violation)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, guild_id, violation_type)
       DO UPDATE SET count = $4, last_violation = $5`,
      [userId, guildId, type, violation.count, violation.lastViolation]
    );
  }

  private async isExempt(member: GuildMember, channel: TextChannel): Promise<boolean> {
    // Bot owner is always exempt
    if (member.id === member.guild.ownerId) return true;
    
    // Check permissions
    if (member.permissions.has([PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageMessages])) {
      return true;
    }

    // Check exempt roles/channels from database
    const exemptions = await db.query(
      `SELECT exempt_roles, exempt_channels FROM automod_filters 
       WHERE guild_id = $1 AND enabled = true`,
      [member.guild.id]
    );

    for (const exemption of exemptions.rows) {
      if (exemption.exempt_roles.some((roleId: string) => member.roles.cache.has(roleId))) {
        return true;
      }
      
      if (exemption.exempt_channels.includes(channel.id)) {
        return true;
      }
    }

    return false;
  }

  private async getActiveFilters(guildId: string): Promise<AutoModFilter[]> {
    const result = await db.query(
      'SELECT * FROM automod_filters WHERE guild_id = $1 AND enabled = true ORDER BY priority DESC',
      [guildId]
    );

    return result.rows;
  }

  public async createFilter(
    guildId: string,
    type: AutoModFilter['type'],
    action: AutoModFilter['action'],
    options: Partial<AutoModFilter> = {}
  ): Promise<string> {
    const result = await db.query(
      `INSERT INTO automod_filters (guild_id, type, action, enabled, threshold, duration, whitelist, blacklist, exempt_roles, exempt_channels)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        guildId,
        type,
        action,
        options.enabled ?? true,
        options.threshold,
        options.duration,
        options.whitelist || [],
        options.blacklist || [],
        options.exemptRoles || [],
        options.exemptChannels || []
      ]
    );

    return result.rows[0].id;
  }

  public async updateFilter(filterId: string, updates: Partial<AutoModFilter>): Promise<boolean> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) return false;

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    const result = await db.query(
      `UPDATE automod_filters SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [filterId, ...values]
    );

    return result.rowCount > 0;
  }

  public async deleteFilter(filterId: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM automod_filters WHERE id = $1',
      [filterId]
    );

    return result.rowCount > 0;
  }

  public async getFilters(guildId: string): Promise<AutoModFilter[]> {
    const result = await db.query(
      'SELECT * FROM automod_filters WHERE guild_id = $1 ORDER BY created_at DESC',
      [guildId]
    );

    return result.rows;
  }

  public async getViolations(guildId: string, userId?: string): Promise<any[]> {
    let query = 'SELECT * FROM automod_violations WHERE guild_id = $1';
    const params = [guildId];

    if (userId) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    query += ' ORDER BY last_violation DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  public async clearViolations(guildId: string, userId?: string, type?: string): Promise<void> {
    let query = 'DELETE FROM automod_violations WHERE guild_id = $1';
    const params = [guildId];

    if (userId) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    if (type) {
      query += ` AND violation_type = $${params.length + 1}`;
      params.push(type);
    }

    await db.query(query, params);
  }
}

export const autoModHandler = AutoModHandler.getInstance();