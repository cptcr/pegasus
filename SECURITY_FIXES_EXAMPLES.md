# Security Fix Implementation Examples

This document provides specific code examples to fix the vulnerabilities identified in the security audit.

## 1. Fix SQL Injection in Database Connection

Replace the vulnerable methods in `src/database/connection.ts` with the secure wrapper:

```typescript
// Instead of using the old db instance:
import { db } from '../database/connection';

// Use the new secure database wrapper:
import { secureDb } from '../database/secureConnection';

// Example: Replace unsafe query
// OLD (VULNERABLE):
const result = await db.query(
  `SELECT * FROM ${table} WHERE user_id = $1`,
  [userId]
);

// NEW (SECURE):
const result = await secureDb.select(table, { user_id: userId });
```

## 2. Fix XP Handler Race Condition

Update `src/handlers/xp.ts` to use atomic operations:

```typescript
// Add Redis-based atomic cooldown check
private async atomicCooldownCheck(key: string): Promise<boolean> {
  const cooldownKey = `cooldown:${key}`;
  
  // Try to set with NX (only if not exists) and EX (expiry)
  const wasSet = await this.redis.set(
    cooldownKey, 
    Date.now().toString(),
    'NX',
    'EX',
    Math.floor(this.COOLDOWN_MS / 1000)
  );
  
  return wasSet === 'OK';
}

// Update handleMessage method
private async handleMessage(message: Message): Promise<void> {
  if (message.author.bot || !message.guild) return;
  
  const key = `${message.guild.id}:${message.author.id}`;
  
  // Atomic cooldown check
  if (!await this.atomicCooldownCheck(key)) {
    return; // On cooldown
  }
  
  // Continue with XP calculation...
}
```

## 3. Fix Economy Transfer Race Condition

Update `src/handlers/economy.ts` transfer method:

```typescript
public async transferCoins(
  fromUserId: string, 
  toUserId: string, 
  guildId: string, 
  amount: number
): Promise<boolean> {
  if (amount <= 0) {
    throw new Error('Transfer amount must be positive');
  }
  
  return await secureDb.transaction(async (client) => {
    // Lock the sender's row for update
    const fromResult = await client.query(
      `SELECT coins FROM economy_users 
       WHERE user_id = $1 AND guild_id = $2 
       FOR UPDATE`,
      [fromUserId, guildId]
    );
    
    if (fromResult.rows.length === 0 || fromResult.rows[0].coins < amount) {
      throw new Error('Insufficient funds');
    }
    
    // Lock the receiver's row
    await client.query(
      `SELECT 1 FROM economy_users 
       WHERE user_id = $1 AND guild_id = $2 
       FOR UPDATE`,
      [toUserId, guildId]
    );
    
    // Perform the transfer
    await client.query(
      'UPDATE economy_users SET coins = coins - $3 WHERE user_id = $1 AND guild_id = $2',
      [fromUserId, guildId, amount]
    );
    
    await client.query(
      'UPDATE economy_users SET coins = coins + $3 WHERE user_id = $1 AND guild_id = $2',
      [toUserId, guildId, amount]
    );
    
    return true;
  });
}
```

## 4. Fix Giveaway Winner Selection

Update `src/handlers/giveaway.ts` to use secure random:

```typescript
import { SecureRandom, SecureLottery } from '../utils/secureRandom';

// In endGiveaway method, replace the winner selection:
// OLD (VULNERABLE):
// winner = weightedEntries[Math.floor(Math.random() * weightedEntries.length)];

// NEW (SECURE):
// Create a map of entries
const entriesMap = new Map<string, number>();
for (const entry of entries.rows) {
  entriesMap.set(entry.user_id, entry.entry_count);
}

// Use secure lottery selection
const winners = SecureLottery.selectWinners(entriesMap, giveaway.winnerCount);
```

## 5. Fix Input Validation in Commands

Example for a command with proper validation:

```typescript
import { SlashCommandBuilder } from 'discord.js';
import { InputSanitizer, ValidateInput } from '../../security/inputSanitizer';
import { z } from 'zod';

// Define validation schema
const transferSchema = z.object({
  user: InputSanitizer.schemas.discordId,
  amount: InputSanitizer.schemas.amount,
  reason: InputSanitizer.schemas.reason
});

export const data = new SlashCommandBuilder()
  .setName('transfer')
  .setDescription('Transfer coins to another user')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to transfer to')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('amount')
      .setDescription('Amount to transfer')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(1000000))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for transfer')
      .setMaxLength(200));

@ValidateInput(transferSchema)
export async function execute(interaction: any) {
  // Get validated options
  const { user, amount, reason } = interaction.options._validated;
  
  // Now you can safely use these validated values
  // They are guaranteed to be properly sanitized and validated
}
```

## 6. Implement Secure Session Management

Create a session manager with proper security:

```typescript
import { SecureRandom } from '../utils/secureRandom';
import { InputSanitizer } from '../security/inputSanitizer';

class SessionManager {
  private sessions = new Map<string, SessionData>();
  private readonly SESSION_DURATION = 3600000; // 1 hour
  
  async createSession(userId: string, guildId: string): Promise<string> {
    // Generate secure session token
    const token = SecureRandom.hex(32);
    const hashedToken = await InputSanitizer.hashSensitiveData(token);
    
    const sessionData: SessionData = {
      userId,
      guildId,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.SESSION_DURATION,
      lastActivity: Date.now()
    };
    
    this.sessions.set(hashedToken, sessionData);
    
    // Store in database for persistence
    await secureDb.insert('sessions', {
      token_hash: hashedToken,
      user_id: userId,
      guild_id: guildId,
      expires_at: new Date(sessionData.expiresAt)
    });
    
    return token; // Return unhashed token to user
  }
  
  async validateSession(token: string): Promise<SessionData | null> {
    const hashedToken = await InputSanitizer.hashSensitiveData(token);
    const session = this.sessions.get(hashedToken);
    
    if (!session || session.expiresAt < Date.now()) {
      this.sessions.delete(hashedToken);
      return null;
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    return session;
  }
}
```

## 7. Add Permission Decorators

Create decorators for command permission checking:

```typescript
import { PermissionFlagsBits } from 'discord.js';

export function RequirePermissions(...permissions: bigint[]) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const [interaction] = args;
      
      if (!interaction.member || !interaction.guild) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          ephemeral: true
        });
        return;
      }
      
      const memberPermissions = interaction.member.permissions;
      const hasPermissions = permissions.every(perm => 
        memberPermissions.has(perm)
      );
      
      if (!hasPermissions) {
        await interaction.reply({
          content: 'You do not have permission to use this command.',
          ephemeral: true
        });
        return;
      }
      
      return await method.apply(this, args);
    };
    
    return descriptor;
  };
}

// Usage example:
@RequirePermissions(PermissionFlagsBits.Administrator)
export async function execute(interaction: any) {
  // This will only run if user has Administrator permission
}
```

## 8. Implement Audit Logging

Add comprehensive audit logging for all sensitive operations:

```typescript
// In any sensitive operation
await auditLogger.log(
  interaction.user.id,
  interaction.guild.id,
  'ECONOMY_TRANSFER',
  AuditCategories.ECONOMY,
  {
    from: fromUserId,
    to: toUserId,
    amount,
    reason,
    balance_before: fromUser.coins,
    balance_after: fromUser.coins - amount
  }
);
```

## 9. Add Rate Limiting to Commands

Implement command-specific rate limiting:

```typescript
import { rateLimiter } from '../../security/rateLimiter';

export async function execute(interaction: any) {
  // Configure rate limit for this command
  rateLimiter.configure('economy_transfer', {
    maxRequests: 5,
    windowMs: 300000, // 5 minutes
    message: 'You can only transfer coins 5 times every 5 minutes.'
  });
  
  // Check rate limit
  const key = `${interaction.user.id}:economy_transfer`;
  const limited = rateLimiter.isRateLimited(key, 'economy_transfer');
  
  if (limited.limited) {
    await interaction.reply({
      content: limited.message,
      ephemeral: true
    });
    return;
  }
  
  // Continue with command execution...
}
```

## 10. Secure Environment Variable Access

Create a secure configuration wrapper:

```typescript
class SecureConfig {
  private static instance: SecureConfig;
  private sensitiveKeys = new Set(['BOT_TOKEN', 'DATABASE_URL', 'API_KEYS']);
  
  get(key: string): string | undefined {
    const value = process.env[key];
    
    // Log access to sensitive values
    if (this.sensitiveKeys.has(key)) {
      logger.security('Sensitive config accessed', {
        key,
        accessor: new Error().stack?.split('\n')[3] // Get caller
      });
    }
    
    return value;
  }
  
  getSafe(key: string, defaultValue: string): string {
    return this.get(key) || defaultValue;
  }
  
  getRequired(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Required configuration ${key} is missing`);
    }
    return value;
  }
}
```

## Implementation Priority

1. **Immediate** (Before any deployment):
   - SQL injection fixes (use SecureDatabase)
   - Input validation on all commands
   - Secure random for all gaming/lottery features

2. **High Priority** (Within 24 hours):
   - Fix race conditions in economy/XP
   - Add permission checks to admin commands
   - Implement audit logging

3. **Medium Priority** (Within 1 week):
   - Session management
   - Enhanced rate limiting
   - Security headers for API

Remember to test all changes thoroughly in a development environment before deploying to production!