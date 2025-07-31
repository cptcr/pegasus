import { Client, Message, VoiceState, GuildMember, TextChannel, Guild } from 'discord.js';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import { getI18n } from '../utils/i18n';
import { logger } from '../utils/logger';
import { config } from '../config';

interface XPMultipliers {
    channel: number;
    role: number;
    user: number;
    event: number;
    weekend: number;
    streak: number;
    total: number;
}

interface XPGainMetadata {
    source: 'message' | 'voice' | 'reaction' | 'command' | 'event';
    channelId: string;
    messageLength?: number;
    voiceDuration?: number;
    multipliers: XPMultipliers;
    isWeekend: boolean;
    streakDays?: number;
}

interface UserXPData {
    userId: string;
    guildId: string;
    xp: number;
    level: number;
    voiceMinutes: number;
    messageCount: number;
    lastMessageTime?: Date;
    streakDays: number;
    lastStreakUpdate?: Date;
}

interface AntiAbuseMetrics {
    messageFrequency: number;
    averageMessageLength: number;
    repetitionScore: number;
    suspicionLevel: number;
}

export class XPHandler extends EventEmitter {
    private db: Pool;
    private redis: Redis;
    private client: Client;
    
    // Cache settings
    private userCache: Map<string, UserXPData> = new Map();
    private multiplierCache: Map<string, any> = new Map();
    private cooldowns: Map<string, number> = new Map();
    
    // Anti-abuse tracking
    private messageHistory: Map<string, string[]> = new Map();
    private abuseScores: Map<string, number> = new Map();
    
    // Configuration
    private readonly BASE_XP = { min: 15, max: 25 };
    private readonly VOICE_XP_PER_MINUTE = 10;
    private readonly COOLDOWN_MS = 60000; // 1 minute
    private readonly STREAK_BONUS_MULTIPLIER = 0.1; // 10% per streak day, max 50%
    private readonly WEEKEND_MULTIPLIER = 1.5;
    private readonly SPAM_THRESHOLD = 5; // messages
    private readonly SPAM_WINDOW = 10000; // 10 seconds
    
    constructor(client: Client, db: Pool, redis: Redis) {
        super();
        this.client = client;
        this.db = db;
        this.redis = redis;
        
        this.setupEventListeners();
        this.startPeriodicTasks();
    }
    
    private setupEventListeners(): void {
        // Message XP
        this.client.on('messageCreate', this.handleMessage.bind(this));
        
        // Voice XP
        this.client.on('voiceStateUpdate', this.handleVoiceUpdate.bind(this));
        
        // Reaction XP (bonus feature)
        this.client.on('messageReactionAdd', this.handleReaction.bind(this));
    }
    
    private startPeriodicTasks(): void {
        // Update voice XP every minute
        setInterval(() => this.updateVoiceXP(), 60000);
        
        // Clear old cooldowns every 5 minutes
        setInterval(() => this.clearOldCooldowns(), 300000);
        
        // Update statistics every hour
        setInterval(() => this.aggregateStatistics(), 3600000);
        
        // Check and update streaks daily
        setInterval(() => this.updateStreaks(), 86400000);
    }
    
    private async handleMessage(message: Message): Promise<void> {
        if (message.author.bot || !message.guild) return;
        
        const key = `${message.guild.id}:${message.author.id}`;
        
        // Check cooldown
        if (this.isOnCooldown(key)) return;
        
        // Anti-abuse check
        const abuseMetrics = await this.checkForAbuse(message);
        if (abuseMetrics.suspicionLevel > 0.8) {
            logger.warn(`Suspicious activity detected for user ${message.author.id}`, abuseMetrics);
            await this.logSuspiciousActivity(message, abuseMetrics);
            return;
        }
        
        try {
            // Calculate XP with all multipliers
            const baseXP = this.calculateBaseXP(message.content.length);
            const multipliers = await this.calculateMultipliers(message);
            const totalXP = Math.round(baseXP * multipliers.total);
            
            // Award XP
            const userData = await this.addXP(
                message.author.id,
                message.guild.id,
                totalXP,
                'message',
                {
                    source: 'message',
                    channelId: message.channel.id,
                    messageLength: message.content.length,
                    multipliers,
                    isWeekend: this.isWeekend(),
                    streakDays: undefined
                }
            );
            
            // Check for level up
            if (userData && this.checkLevelUp(userData)) {
                await this.handleLevelUp(message.member!, userData);
            }
            
            // Set cooldown
            this.setCooldown(key);
            
        } catch (error) {
            logger.error('Error handling message XP:', error);
        }
    }
    
    private async handleVoiceUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
        if (!newState.guild || newState.member?.user.bot) return;
        
        const userId = newState.member.id;
        const guildId = newState.guild.id;
        
        // User joined voice channel
        if (!oldState.channel && newState.channel) {
            await this.redis.set(
                `voice:${guildId}:${userId}`,
                Date.now().toString(),
                'EX',
                86400 // 24 hours expiry
            );
        }
        
        // User left voice channel
        if (oldState.channel && !newState.channel) {
            const startTime = await this.redis.get(`voice:${guildId}:${userId}`);
            if (startTime) {
                const duration = Math.floor((Date.now() - parseInt(startTime)) / 60000); // minutes
                if (duration > 0) {
                    await this.awardVoiceXP(userId, guildId, duration);
                }
                await this.redis.del(`voice:${guildId}:${userId}`);
            }
        }
    }
    
    private async handleReaction(reaction: any, user: any): Promise<void> {
        if (user.bot || !reaction.message.guild) return;
        
        // Small XP bonus for reactions (with cooldown)
        const key = `reaction:${reaction.message.guild.id}:${user.id}`;
        if (this.isOnCooldown(key)) return;
        
        const xp = 5; // Small reaction bonus
        await this.addXP(user.id, reaction.message.guild.id, xp, 'reaction', {
            source: 'reaction',
            channelId: reaction.message.channel.id,
            multipliers: await this.calculateMultipliers(reaction.message),
            isWeekend: this.isWeekend()
        });
        
        this.setCooldown(key, 300000); // 5 minute cooldown for reactions
    }
    
    private async calculateMultipliers(message: Message): Promise<XPMultipliers> {
        const guildId = message.guild!.id;
        const userId = message.author.id;
        const channelId = message.channel.id;
        
        // Get multipliers from database/cache
        const [channelMult, roleMults, userMult, eventMult] = await Promise.all([
            this.getChannelMultiplier(guildId, channelId),
            this.getRoleMultipliers(message.member!),
            this.getUserMultiplier(guildId, userId),
            this.getEventMultiplier(guildId)
        ]);
        
        // Weekend bonus
        const weekendMult = this.isWeekend() ? this.WEEKEND_MULTIPLIER : 1;
        
        // Streak bonus
        const userData = await this.getUserData(userId, guildId);
        const streakMult = 1 + Math.min(userData.streakDays * this.STREAK_BONUS_MULTIPLIER, 0.5);
        
        // Calculate total multiplier
        const total = channelMult * roleMults * userMult * eventMult * weekendMult * streakMult;
        
        return {
            channel: channelMult,
            role: roleMults,
            user: userMult,
            event: eventMult,
            weekend: weekendMult,
            streak: streakMult,
            total
        };
    }
    
    private async getChannelMultiplier(guildId: string, channelId: string): Promise<number> {
        const cacheKey = `channelMult:${guildId}:${channelId}`;
        
        // Check cache
        if (this.multiplierCache.has(cacheKey)) {
            return this.multiplierCache.get(cacheKey);
        }
        
        try {
            const result = await this.db.query(
                'SELECT multiplier FROM xp_channel_multipliers WHERE guild_id = $1 AND channel_id = $2 AND active = true',
                [guildId, channelId]
            );
            
            const multiplier = result.rows[0]?.multiplier || 1;
            this.multiplierCache.set(cacheKey, multiplier);
            
            // Cache for 5 minutes
            setTimeout(() => this.multiplierCache.delete(cacheKey), 300000);
            
            return multiplier;
        } catch (error) {
            logger.error('Error getting channel multiplier:', error);
            return 1;
        }
    }
    
    private async getRoleMultipliers(member: GuildMember): Promise<number> {
        try {
            const roleIds = member.roles.cache.map(role => role.id);
            
            const result = await this.db.query(
                'SELECT MAX(multiplier) as multiplier FROM xp_role_multipliers WHERE guild_id = $1 AND role_id = ANY($2) AND active = true',
                [member.guild.id, roleIds]
            );
            
            return result.rows[0]?.multiplier || 1;
        } catch (error) {
            logger.error('Error getting role multipliers:', error);
            return 1;
        }
    }
    
    private async getUserMultiplier(guildId: string, userId: string): Promise<number> {
        try {
            const result = await this.db.query(
                'SELECT multiplier FROM xp_user_multipliers WHERE guild_id = $1 AND user_id = $2 AND active = true AND (expires_at IS NULL OR expires_at > NOW())',
                [guildId, userId]
            );
            
            return result.rows[0]?.multiplier || 1;
        } catch (error) {
            logger.error('Error getting user multiplier:', error);
            return 1;
        }
    }
    
    private async getEventMultiplier(guildId: string): Promise<number> {
        try {
            const result = await this.db.query(
                'SELECT multiplier FROM xp_event_multipliers WHERE guild_id = $1 AND active = true AND NOW() BETWEEN start_time AND end_time',
                [guildId]
            );
            
            return result.rows[0]?.multiplier || 1;
        } catch (error) {
            logger.error('Error getting event multiplier:', error);
            return 1;
        }
    }
    
    private async checkForAbuse(message: Message): Promise<AntiAbuseMetrics> {
        const key = `${message.guild!.id}:${message.author.id}`;
        const now = Date.now();
        
        // Get message history
        let history = this.messageHistory.get(key) || [];
        history.push(message.content);
        
        // Keep only recent messages
        if (history.length > 10) {
            history = history.slice(-10);
        }
        this.messageHistory.set(key, history);
        
        // Calculate metrics
        const messageFrequency = history.length / (this.SPAM_WINDOW / 1000);
        const averageMessageLength = history.reduce((sum, msg) => sum + msg.length, 0) / history.length;
        
        // Check for repetition
        const uniqueMessages = new Set(history).size;
        const repetitionScore = 1 - (uniqueMessages / history.length);
        
        // Calculate suspicion level
        let suspicionLevel = 0;
        
        if (messageFrequency > this.SPAM_THRESHOLD / (this.SPAM_WINDOW / 1000)) {
            suspicionLevel += 0.4;
        }
        
        if (averageMessageLength < 5) {
            suspicionLevel += 0.2;
        }
        
        if (repetitionScore > 0.7) {
            suspicionLevel += 0.4;
        }
        
        // Update abuse score
        const currentScore = this.abuseScores.get(key) || 0;
        const newScore = currentScore * 0.9 + suspicionLevel * 0.1; // Exponential decay
        this.abuseScores.set(key, newScore);
        
        return {
            messageFrequency,
            averageMessageLength,
            repetitionScore,
            suspicionLevel: newScore
        };
    }
    
    private async logSuspiciousActivity(message: Message, metrics: AntiAbuseMetrics): Promise<void> {
        try {
            await this.db.query(
                `INSERT INTO xp_anti_abuse_logs 
                (guild_id, user_id, action_type, metadata, created_at) 
                VALUES ($1, $2, $3, $4, NOW())`,
                [
                    message.guild!.id,
                    message.author.id,
                    'suspicious_activity',
                    JSON.stringify({
                        ...metrics,
                        channelId: message.channel.id,
                        messageContent: message.content.substring(0, 100)
                    })
                ]
            );
        } catch (error) {
            logger.error('Error logging suspicious activity:', error);
        }
    }
    
    private async addXP(
        userId: string,
        guildId: string,
        amount: number,
        source: string,
        metadata: XPGainMetadata
    ): Promise<UserXPData> {
        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');
            
            // Update user XP
            const userResult = await client.query(
                `INSERT INTO user_xp (user_id, guild_id, xp, level, message_count, voice_minutes, streak_days, last_message_time)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET 
                    xp = user_xp.xp + $3,
                    level = $4,
                    message_count = CASE WHEN $8 = 'message' THEN user_xp.message_count + 1 ELSE user_xp.message_count END,
                    voice_minutes = CASE WHEN $8 = 'voice' THEN user_xp.voice_minutes + $9 ELSE user_xp.voice_minutes END,
                    last_message_time = NOW(),
                    updated_at = NOW()
                RETURNING *`,
                [
                    userId,
                    guildId,
                    amount,
                    this.calculateLevel(amount),
                    source === 'message' ? 1 : 0,
                    source === 'voice' ? metadata.voiceDuration || 0 : 0,
                    1, // Initial streak
                    source,
                    metadata.voiceDuration || 0
                ]
            );
            
            const userData = userResult.rows[0];
            
            // Log XP gain
            await client.query(
                `INSERT INTO xp_logs 
                (user_id, guild_id, amount, source, channel_id, multiplier, metadata, timestamp)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [
                    userId,
                    guildId,
                    amount,
                    source,
                    metadata.channelId,
                    metadata.multipliers.total,
                    JSON.stringify(metadata)
                ]
            );
            
            // Update daily statistics
            await client.query(
                `INSERT INTO xp_daily_stats (guild_id, user_id, date, xp_gained, messages_sent, voice_minutes)
                VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)
                ON CONFLICT (guild_id, user_id, date)
                DO UPDATE SET
                    xp_gained = xp_daily_stats.xp_gained + $3,
                    messages_sent = xp_daily_stats.messages_sent + $4,
                    voice_minutes = xp_daily_stats.voice_minutes + $5,
                    updated_at = NOW()`,
                [
                    guildId,
                    userId,
                    amount,
                    source === 'message' ? 1 : 0,
                    source === 'voice' ? metadata.voiceDuration || 0 : 0
                ]
            );
            
            await client.query('COMMIT');
            
            // Update cache
            this.userCache.set(`${guildId}:${userId}`, userData);
            
            // Emit XP gain event
            this.emit('xpGain', {
                userId,
                guildId,
                amount,
                newTotal: userData.xp,
                level: userData.level,
                source,
                metadata
            });
            
            return userData;
            
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error adding XP:', error);
            throw error;
        } finally {
            client.release();
        }
    }
    
    private async awardVoiceXP(userId: string, guildId: string, minutes: number): Promise<void> {
        const xp = minutes * this.VOICE_XP_PER_MINUTE;
        const multipliers = await this.calculateVoiceMultipliers(guildId, userId);
        const totalXP = Math.round(xp * multipliers.total);
        
        await this.addXP(userId, guildId, totalXP, 'voice', {
            source: 'voice',
            channelId: '', // Could track voice channel if needed
            voiceDuration: minutes,
            multipliers,
            isWeekend: this.isWeekend()
        });
    }
    
    private async calculateVoiceMultipliers(guildId: string, userId: string): Promise<XPMultipliers> {
        // Simplified multipliers for voice (no channel multiplier)
        const [roleMults, userMult, eventMult] = await Promise.all([
            this.getRoleMultipliersByUserId(guildId, userId),
            this.getUserMultiplier(guildId, userId),
            this.getEventMultiplier(guildId)
        ]);
        
        const weekendMult = this.isWeekend() ? this.WEEKEND_MULTIPLIER : 1;
        const userData = await this.getUserData(userId, guildId);
        const streakMult = 1 + Math.min(userData.streakDays * this.STREAK_BONUS_MULTIPLIER, 0.5);
        
        const total = roleMults * userMult * eventMult * weekendMult * streakMult;
        
        return {
            channel: 1,
            role: roleMults,
            user: userMult,
            event: eventMult,
            weekend: weekendMult,
            streak: streakMult,
            total
        };
    }
    
    private async getRoleMultipliersByUserId(guildId: string, userId: string): Promise<number> {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return 1;
            
            const member = await guild.members.fetch(userId);
            return this.getRoleMultipliers(member);
        } catch (error) {
            logger.error('Error getting role multipliers by user ID:', error);
            return 1;
        }
    }
    
    private checkLevelUp(userData: UserXPData): boolean {
        const newLevel = this.calculateLevel(userData.xp);
        return newLevel > userData.level;
    }
    
    public calculateLevel(xp: number): number {
        // XP required = 100 * level * (level + 1) / 2
        // Solving for level: level = (-1 + sqrt(1 + 8 * xp / 100)) / 2
        return Math.floor((-1 + Math.sqrt(1 + 8 * xp / 100)) / 2);
    }
    
    public calculateXPForLevel(level: number): number {
        return 100 * level * (level + 1) / 2;
    }
    
    private async handleLevelUp(member: GuildMember, userData: UserXPData): Promise<void> {
        const newLevel = this.calculateLevel(userData.xp);
        const i18n = getI18n(member.guild.preferredLocale || 'en');
        
        try {
            // Update level in database
            await this.db.query(
                'UPDATE user_xp SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                [newLevel, userData.userId, userData.guildId]
            );
            
            // Check for role rewards
            await this.assignLevelRoles(member, newLevel);
            
            // Get level up channel
            const channelResult = await this.db.query(
                'SELECT level_up_channel_id FROM guild_xp_settings WHERE guild_id = $1',
                [member.guild.id]
            );
            
            const channelId = channelResult.rows[0]?.level_up_channel_id;
            if (channelId) {
                const channel = member.guild.channels.cache.get(channelId) as TextChannel;
                if (channel) {
                    await channel.send({
                        content: i18n.t('xp.levelUp', {
                            user: member.toString(),
                            level: newLevel
                        }),
                        allowedMentions: { users: [member.id] }
                    });
                }
            }
            
            // Emit level up event
            this.emit('levelUp', {
                member,
                oldLevel: userData.level,
                newLevel,
                xp: userData.xp
            });
            
        } catch (error) {
            logger.error('Error handling level up:', error);
        }
    }
    
    private async assignLevelRoles(member: GuildMember, level: number): Promise<void> {
        try {
            const result = await this.db.query(
                `SELECT role_id, remove_previous 
                FROM xp_role_rewards 
                WHERE guild_id = $1 AND level <= $2 
                ORDER BY level DESC`,
                [member.guild.id, level]
            );
            
            if (result.rows.length === 0) return;
            
            const roleReward = result.rows[0];
            const role = member.guild.roles.cache.get(roleReward.role_id);
            
            if (role && !member.roles.cache.has(role.id)) {
                // Remove previous level roles if configured
                if (roleReward.remove_previous) {
                    const allLevelRoles = result.rows.slice(1).map(r => r.role_id);
                    const rolesToRemove = member.roles.cache.filter(r => allLevelRoles.includes(r.id));
                    if (rolesToRemove.size > 0) {
                        await member.roles.remove(rolesToRemove);
                    }
                }
                
                // Add new role
                await member.roles.add(role);
                
                logger.info(`Assigned level ${level} role to ${member.user.tag} in ${member.guild.name}`);
            }
        } catch (error) {
            logger.error('Error assigning level roles:', error);
        }
    }
    
    public async getUserData(userId: string, guildId: string): Promise<UserXPData> {
        const cacheKey = `${guildId}:${userId}`;
        
        // Check cache
        if (this.userCache.has(cacheKey)) {
            return this.userCache.get(cacheKey)!;
        }
        
        try {
            const result = await this.db.query(
                'SELECT * FROM user_xp WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );
            
            if (result.rows.length === 0) {
                // Create new user entry
                const newUser: UserXPData = {
                    userId,
                    guildId,
                    xp: 0,
                    level: 0,
                    voiceMinutes: 0,
                    messageCount: 0,
                    streakDays: 0
                };
                
                await this.db.query(
                    `INSERT INTO user_xp (user_id, guild_id, xp, level, voice_minutes, message_count, streak_days)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [userId, guildId, 0, 0, 0, 0, 0]
                );
                
                this.userCache.set(cacheKey, newUser);
                return newUser;
            }
            
            const userData = result.rows[0];
            this.userCache.set(cacheKey, userData);
            return userData;
            
        } catch (error) {
            logger.error('Error getting user data:', error);
            throw error;
        }
    }
    
    private calculateBaseXP(messageLength: number): number {
        // Base XP with slight bonus for longer messages
        const lengthBonus = Math.min(messageLength / 100, 1) * 5;
        return Math.floor(Math.random() * (this.BASE_XP.max - this.BASE_XP.min + 1)) + this.BASE_XP.min + lengthBonus;
    }
    
    private isWeekend(): boolean {
        const day = new Date().getDay();
        return day === 0 || day === 6; // Sunday or Saturday
    }
    
    private isOnCooldown(key: string): boolean {
        const lastTime = this.cooldowns.get(key);
        if (!lastTime) return false;
        return Date.now() - lastTime < this.COOLDOWN_MS;
    }
    
    private setCooldown(key: string, duration: number = this.COOLDOWN_MS): void {
        this.cooldowns.set(key, Date.now());
    }
    
    private clearOldCooldowns(): void {
        const now = Date.now();
        for (const [key, time] of this.cooldowns.entries()) {
            if (now - time > this.COOLDOWN_MS * 2) {
                this.cooldowns.delete(key);
            }
        }
    }
    
    private async updateVoiceXP(): Promise<void> {
        // Update XP for all users currently in voice channels
        const keys = await this.redis.keys('voice:*');
        
        for (const key of keys) {
            const [, guildId, userId] = key.split(':');
            const startTime = await this.redis.get(key);
            
            if (startTime) {
                const duration = Math.floor((Date.now() - parseInt(startTime)) / 60000);
                if (duration >= 1) {
                    await this.awardVoiceXP(userId, guildId, duration);
                    await this.redis.set(key, Date.now().toString(), 'EX', 86400);
                }
            }
        }
    }
    
    private async updateStreaks(): Promise<void> {
        try {
            // Update streaks for all users who were active today
            await this.db.query(`
                UPDATE user_xp
                SET streak_days = CASE
                    WHEN last_message_time::date = CURRENT_DATE - INTERVAL '1 day' THEN streak_days + 1
                    WHEN last_message_time::date < CURRENT_DATE - INTERVAL '1 day' THEN 0
                    ELSE streak_days
                END,
                last_streak_update = NOW()
                WHERE last_message_time IS NOT NULL
            `);
            
            logger.info('Updated user streaks');
        } catch (error) {
            logger.error('Error updating streaks:', error);
        }
    }
    
    private async aggregateStatistics(): Promise<void> {
        try {
            // Aggregate XP statistics for analytics
            await this.db.query(`
                INSERT INTO xp_statistics (guild_id, period_type, period_start, period_end, total_xp, total_messages, total_voice_minutes, unique_users)
                SELECT 
                    guild_id,
                    'hourly' as period_type,
                    date_trunc('hour', NOW() - INTERVAL '1 hour') as period_start,
                    date_trunc('hour', NOW()) as period_end,
                    SUM(xp_gained) as total_xp,
                    SUM(messages_sent) as total_messages,
                    SUM(voice_minutes) as total_voice_minutes,
                    COUNT(DISTINCT user_id) as unique_users
                FROM xp_daily_stats
                WHERE date = CURRENT_DATE
                GROUP BY guild_id
                ON CONFLICT (guild_id, period_type, period_start)
                DO UPDATE SET
                    total_xp = EXCLUDED.total_xp,
                    total_messages = EXCLUDED.total_messages,
                    total_voice_minutes = EXCLUDED.total_voice_minutes,
                    unique_users = EXCLUDED.unique_users,
                    updated_at = NOW()
            `);
            
            logger.info('Aggregated XP statistics');
        } catch (error) {
            logger.error('Error aggregating statistics:', error);
        }
    }
    
    // Public API methods
    
    public async getLeaderboard(guildId: string, limit: number = 10, offset: number = 0): Promise<any[]> {
        try {
            const result = await this.db.query(
                `SELECT 
                    user_id,
                    xp,
                    level,
                    message_count,
                    voice_minutes,
                    streak_days,
                    RANK() OVER (ORDER BY xp DESC) as rank
                FROM user_xp
                WHERE guild_id = $1
                ORDER BY xp DESC
                LIMIT $2 OFFSET $3`,
                [guildId, limit, offset]
            );
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting leaderboard:', error);
            return [];
        }
    }
    
    public async getUserRank(userId: string, guildId: string): Promise<number> {
        try {
            const result = await this.db.query(
                `SELECT rank FROM (
                    SELECT user_id, RANK() OVER (ORDER BY xp DESC) as rank
                    FROM user_xp
                    WHERE guild_id = $1
                ) ranked
                WHERE user_id = $2`,
                [guildId, userId]
            );
            
            return result.rows[0]?.rank || 0;
        } catch (error) {
            logger.error('Error getting user rank:', error);
            return 0;
        }
    }
    
    public async setChannelMultiplier(guildId: string, channelId: string, multiplier: number): Promise<void> {
        try {
            await this.db.query(
                `INSERT INTO xp_channel_multipliers (guild_id, channel_id, multiplier)
                VALUES ($1, $2, $3)
                ON CONFLICT (guild_id, channel_id)
                DO UPDATE SET multiplier = $3, active = true, updated_at = NOW()`,
                [guildId, channelId, multiplier]
            );
            
            // Clear cache
            this.multiplierCache.delete(`channelMult:${guildId}:${channelId}`);
        } catch (error) {
            logger.error('Error setting channel multiplier:', error);
            throw error;
        }
    }
    
    public async setRoleMultiplier(guildId: string, roleId: string, multiplier: number): Promise<void> {
        try {
            await this.db.query(
                `INSERT INTO xp_role_multipliers (guild_id, role_id, multiplier)
                VALUES ($1, $2, $3)
                ON CONFLICT (guild_id, role_id)
                DO UPDATE SET multiplier = $3, active = true, updated_at = NOW()`,
                [guildId, roleId, multiplier]
            );
        } catch (error) {
            logger.error('Error setting role multiplier:', error);
            throw error;
        }
    }
    
    public async setUserMultiplier(guildId: string, userId: string, multiplier: number, reason: string, expiresAt?: Date): Promise<void> {
        try {
            await this.db.query(
                `INSERT INTO xp_user_multipliers (guild_id, user_id, multiplier, reason, expires_at)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (guild_id, user_id)
                DO UPDATE SET multiplier = $3, reason = $4, expires_at = $5, active = true, updated_at = NOW()`,
                [guildId, userId, multiplier, reason, expiresAt]
            );
        } catch (error) {
            logger.error('Error setting user multiplier:', error);
            throw error;
        }
    }
    
    public async createEventMultiplier(guildId: string, name: string, multiplier: number, startTime: Date, endTime: Date): Promise<void> {
        try {
            await this.db.query(
                `INSERT INTO xp_event_multipliers (guild_id, event_name, multiplier, start_time, end_time)
                VALUES ($1, $2, $3, $4, $5)`,
                [guildId, name, multiplier, startTime, endTime]
            );
        } catch (error) {
            logger.error('Error creating event multiplier:', error);
            throw error;
        }
    }
    
    public async addRoleReward(guildId: string, level: number, roleId: string, removePrevious: boolean = false): Promise<void> {
        try {
            await this.db.query(
                `INSERT INTO xp_role_rewards (guild_id, level, role_id, remove_previous)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (guild_id, level)
                DO UPDATE SET role_id = $3, remove_previous = $4, updated_at = NOW()`,
                [guildId, level, roleId, removePrevious]
            );
        } catch (error) {
            logger.error('Error adding role reward:', error);
            throw error;
        }
    }
    
    public async resetUserXP(userId: string, guildId: string): Promise<void> {
        try {
            await this.db.query(
                'UPDATE user_xp SET xp = 0, level = 0, streak_days = 0 WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );
            
            // Clear cache
            this.userCache.delete(`${guildId}:${userId}`);
        } catch (error) {
            logger.error('Error resetting user XP:', error);
            throw error;
        }
    }
    
    public async getXPStatistics(guildId: string, periodType: 'hourly' | 'daily' | 'weekly' | 'monthly', limit: number = 24): Promise<any[]> {
        try {
            const result = await this.db.query(
                `SELECT * FROM xp_statistics
                WHERE guild_id = $1 AND period_type = $2
                ORDER BY period_start DESC
                LIMIT $3`,
                [guildId, periodType, limit]
            );
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting XP statistics:', error);
            return [];
        }
    }
}

// Export singleton instance
export default XPHandler;