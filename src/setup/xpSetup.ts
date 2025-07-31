import { Client } from 'discord.js';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { XPHandler } from '../handlers/xp';
import { logger } from '../utils/logger';

/**
 * Initialize the XP Handler for the bot
 * This should be called after database and Redis connections are established
 */
export async function setupXPHandler(client: Client, db: Pool, redis: Redis): Promise<void> {
    try {
        // Create XP handler instance
        const xpHandler = new XPHandler(client, db, redis);
        
        // Attach to client for global access
        (client as any).xpHandler = xpHandler;
        
        // Set up event listeners for XP events
        xpHandler.on('xpGain', (data) => {
            logger.debug(`XP Gain: ${data.userId} gained ${data.amount} XP in guild ${data.guildId}`);
        });
        
        xpHandler.on('levelUp', (data) => {
            logger.info(`Level Up: ${data.member.user.tag} reached level ${data.newLevel} in ${data.member.guild.name}`);
        });
        
        logger.info('XP Handler initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize XP handler:', error);
        throw error;
    }
}

/**
 * Example integration in your main bot file:
 * 
 * import { setupXPHandler } from './setup/xpSetup';
 * 
 * // After client, database, and Redis are ready:
 * await setupXPHandler(client, db, redis);
 */