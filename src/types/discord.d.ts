import { XPHandler } from '../handlers/xp';
import { Pool } from 'pg';
import { Redis } from 'ioredis';

declare module 'discord.js' {
    interface Client {
        xpHandler: XPHandler;
        db: Pool;
        redis: Redis;
    }
}