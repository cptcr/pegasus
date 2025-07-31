# XP System Integration Guide

## Overview
The enhanced XP system provides a comprehensive experience point tracking system with advanced features including multipliers, anti-abuse detection, streak tracking, and role rewards.

## Setup Instructions

### 1. Database Setup
Ensure the XP system tables are created by running migration `006_xp_system_enhancements.sql`.

### 2. Initialize XP Handler
In your main bot file, after establishing database and Redis connections:

```typescript
import { XPHandler } from './handlers/xp';

// Initialize the XP handler
client.xpHandler = new XPHandler(client, db, redis);
```

### 3. Type Declarations
The `src/types/discord.d.ts` file extends the Discord.js Client type to include the XP handler:

```typescript
declare module 'discord.js' {
    interface Client {
        xpHandler: XPHandler;
        db: Pool;
        redis: Redis;
    }
}
```

## Features

### 1. Multiplier System
- **Channel Multipliers**: Different XP rates for specific channels
- **Role Multipliers**: Bonus XP for users with certain roles
- **User Multipliers**: Individual user bonuses (e.g., premium members)
- **Event Multipliers**: Server-wide XP events
- **Weekend Bonus**: Automatic 1.5x multiplier on weekends
- **Streak Bonus**: Up to 50% bonus based on daily activity streaks

### 2. Anti-Abuse Detection
- Message frequency monitoring
- Content repetition detection
- Automatic spam detection with suspicion scoring
- Detailed logging of suspicious activities

### 3. XP Sources
- **Messages**: 15-25 base XP per message with cooldown
- **Voice**: 10 XP per minute in voice channels
- **Reactions**: 5 XP for reactions (with separate cooldown)

### 4. Role Rewards
- Automatic role assignment at specified levels
- Option to remove previous level roles
- Configurable per guild

## Commands

### User Commands

#### `/level [user]`
Check XP level and statistics for yourself or another user.

#### `/leaderboard [page]`
View the server XP leaderboard with pagination.

### Admin Commands

#### `/xpconfig channel-multiplier <channel> <multiplier>`
Set XP multiplier for a specific channel (0-10x).

#### `/xpconfig role-multiplier <role> <multiplier>`
Set XP multiplier for a specific role (0-10x).

#### `/xpconfig user-multiplier <user> <multiplier> <reason> [duration]`
Set XP multiplier for a specific user with optional expiration.

#### `/xpconfig event <name> <multiplier> <duration>`
Create a server-wide XP event with increased multipliers.

#### `/xpconfig role-reward <level> <role> [remove-previous]`
Configure automatic role rewards for reaching specific levels.

#### `/xpconfig reset-user <user>`
Reset a user's XP and level to 0.

## API Methods

### Get User Data
```typescript
const userData = await xpHandler.getUserData(userId, guildId);
```

### Get Leaderboard
```typescript
const leaderboard = await xpHandler.getLeaderboard(guildId, limit, offset);
```

### Get User Rank
```typescript
const rank = await xpHandler.getUserRank(userId, guildId);
```

### Set Multipliers
```typescript
// Channel multiplier
await xpHandler.setChannelMultiplier(guildId, channelId, multiplier);

// Role multiplier
await xpHandler.setRoleMultiplier(guildId, roleId, multiplier);

// User multiplier
await xpHandler.setUserMultiplier(guildId, userId, multiplier, reason, expiresAt);
```

### Create Event
```typescript
await xpHandler.createEventMultiplier(guildId, name, multiplier, startTime, endTime);
```

### Configure Role Rewards
```typescript
await xpHandler.addRoleReward(guildId, level, roleId, removePrevious);
```

### Get Statistics
```typescript
const stats = await xpHandler.getXPStatistics(guildId, 'hourly', 24);
```

## Events

The XP handler emits the following events:

### `xpGain`
Emitted when a user gains XP.
```typescript
xpHandler.on('xpGain', (data) => {
    // data.userId, data.guildId, data.amount, data.newTotal, data.level, data.source, data.metadata
});
```

### `levelUp`
Emitted when a user levels up.
```typescript
xpHandler.on('levelUp', (data) => {
    // data.member, data.oldLevel, data.newLevel, data.xp
});
```

## Configuration

### Base Values
- Base XP per message: 15-25
- Voice XP per minute: 10
- Message cooldown: 60 seconds
- Reaction cooldown: 5 minutes
- Weekend multiplier: 1.5x
- Max streak bonus: 50%

### Anti-Abuse Settings
- Spam threshold: 5 messages in 10 seconds
- Suspicion level threshold: 0.8
- Message history tracking: Last 10 messages

## Performance Considerations

1. **Caching**: User data and multipliers are cached in memory
2. **Connection Pooling**: Uses PostgreSQL connection pooling
3. **Redis**: Voice session tracking uses Redis for persistence
4. **Batch Operations**: Statistics are aggregated hourly
5. **Indexes**: Ensure proper database indexes are created (see migration)

## Troubleshooting

### Common Issues

1. **XP not being awarded**
   - Check if user is on cooldown
   - Verify anti-abuse system isn't blocking the user
   - Ensure database connection is active

2. **Level roles not being assigned**
   - Verify bot has appropriate permissions
   - Check role hierarchy (bot role must be higher)
   - Confirm role rewards are configured

3. **Performance issues**
   - Monitor database query performance
   - Check cache hit rates
   - Consider implementing sharding for large bots

## Example Integration

```typescript
// In your main bot file
import { Client, GatewayIntentBits } from 'discord.js';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { XPHandler } from './handlers/xp';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

// Initialize database and Redis
const db = new Pool({ /* your config */ });
const redis = new Redis({ /* your config */ });

// Initialize XP handler
client.xpHandler = new XPHandler(client, db, redis);

// Ready event
client.on('ready', () => {
    console.log('Bot is ready with XP system!');
});

client.login(process.env.DISCORD_TOKEN);
```