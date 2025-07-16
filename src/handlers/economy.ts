import { User, GuildMember, TextChannel } from 'discord.js';
import { db } from '../database/connection';
import { createEmbed, createSuccessEmbed, createErrorEmbed, formatNumber } from '../utils/helpers';
import { colors, emojis } from '../utils/config';

interface EconomyUser {
  userId: string;
  guildId: string;
  coins: number;
  bank: number;
  bankLimit: number;
  lastDaily: Date | null;
  lastWeekly: Date | null;
  lastWork: Date | null;
  workStreak: number;
  dailyStreak: number;
  totalEarned: number;
  totalSpent: number;
  inventory: any[];
  multiplier: number;
  prestige: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ShopItem {
  id: string;
  guildId: string;
  name: string;
  description: string;
  price: number;
  type: 'role' | 'item' | 'consumable' | 'upgrade';
  roleId?: string;
  emoji?: string;
  stock: number;
  maxStock: number;
  enabled: boolean;
  requirements: any;
  effects: any;
  createdAt: Date;
}

interface Transaction {
  id: string;
  userId: string;
  guildId: string;
  type: 'earn' | 'spend' | 'transfer' | 'daily' | 'weekly' | 'work' | 'gamble' | 'shop';
  amount: number;
  description: string;
  fromUser?: string;
  toUser?: string;
  itemId?: string;
  createdAt: Date;
}

export class EconomyHandler {
  private static instance: EconomyHandler;
  private workCooldowns = new Map<string, number>();
  private dailyCooldowns = new Map<string, number>();
  private weeklyCooldowns = new Map<string, number>();

  // Work job types with different pay ranges
  private workJobs = [
    { name: 'Developer', emoji: '💻', min: 100, max: 300, description: 'Fixed some bugs' },
    { name: 'Teacher', emoji: '📚', min: 80, max: 200, description: 'Taught some classes' },
    { name: 'Chef', emoji: '👨‍🍳', min: 90, max: 250, description: 'Cooked delicious meals' },
    { name: 'Artist', emoji: '🎨', min: 70, max: 400, description: 'Created beautiful art' },
    { name: 'Musician', emoji: '🎵', min: 60, max: 350, description: 'Performed amazing music' },
    { name: 'Writer', emoji: '✍️', min: 75, max: 275, description: 'Wrote engaging content' },
    { name: 'Gamer', emoji: '🎮', min: 50, max: 180, description: 'Won some tournaments' },
    { name: 'Streamer', emoji: '📺', min: 40, max: 500, description: 'Entertained viewers' },
    { name: 'Trader', emoji: '📈', min: 30, max: 600, description: 'Made profitable trades' },
    { name: 'Miner', emoji: '⛏️', min: 80, max: 220, description: 'Mined precious resources' },
  ];

  public static getInstance(): EconomyHandler {
    if (!EconomyHandler.instance) {
      EconomyHandler.instance = new EconomyHandler();
    }
    return EconomyHandler.instance;
  }

  public async getUser(userId: string, guildId: string): Promise<EconomyUser> {
    let result = await db.query(
      'SELECT * FROM economy_users WHERE user_id = $1 AND guild_id = $2',
      [userId, guildId]
    );

    if (result.rows.length === 0) {
      // Create new user
      await db.query(
        `INSERT INTO economy_users (user_id, guild_id, coins, bank, bank_limit) 
         VALUES ($1, $2, 1000, 0, 10000)`,
        [userId, guildId]
      );

      result = await db.query(
        'SELECT * FROM economy_users WHERE user_id = $1 AND guild_id = $2',
        [userId, guildId]
      );
    }

    const user = result.rows[0];
    return {
      userId: user.user_id,
      guildId: user.guild_id,
      coins: user.coins,
      bank: user.bank,
      bankLimit: user.bank_limit,
      lastDaily: user.last_daily,
      lastWeekly: user.last_weekly,
      lastWork: user.last_work,
      workStreak: user.work_streak || 0,
      dailyStreak: user.daily_streak || 0,
      totalEarned: user.total_earned || 0,
      totalSpent: user.total_spent || 0,
      inventory: user.inventory || [],
      multiplier: user.multiplier || 1,
      prestige: user.prestige || 0,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  public async addCoins(userId: string, guildId: string, amount: number, reason: string): Promise<void> {
    await db.query(
      `UPDATE economy_users 
       SET coins = coins + $3, total_earned = total_earned + $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND guild_id = $2`,
      [userId, guildId, amount]
    );

    await this.logTransaction(userId, guildId, 'earn', amount, reason);
  }

  public async removeCoins(userId: string, guildId: string, amount: number, reason: string): Promise<boolean> {
    const user = await this.getUser(userId, guildId);
    if (user.coins < amount) return false;

    await db.query(
      `UPDATE economy_users 
       SET coins = coins - $3, total_spent = total_spent + $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND guild_id = $2`,
      [userId, guildId, amount]
    );

    await this.logTransaction(userId, guildId, 'spend', amount, reason);
    return true;
  }

  public async transferCoins(fromUserId: string, toUserId: string, guildId: string, amount: number): Promise<boolean> {
    const fromUser = await this.getUser(fromUserId, guildId);
    if (fromUser.coins < amount) return false;

    // Use transaction to ensure atomicity
    await db.transaction(async (client) => {
      await client.query(
        'UPDATE economy_users SET coins = coins - $3 WHERE user_id = $1 AND guild_id = $2',
        [fromUserId, guildId, amount]
      );

      await client.query(
        'UPDATE economy_users SET coins = coins + $3 WHERE user_id = $1 AND guild_id = $2',
        [toUserId, guildId, amount]
      );
    });

    await this.logTransaction(fromUserId, guildId, 'transfer', amount, 'Transfer out', toUserId);
    await this.logTransaction(toUserId, guildId, 'transfer', amount, 'Transfer in', fromUserId);

    return true;
  }

  public async dailyReward(userId: string, guildId: string): Promise<{ amount: number; streak: number; cooldown?: number }> {
    const user = await this.getUser(userId, guildId);
    const now = new Date();
    const lastDaily = user.lastDaily ? new Date(user.lastDaily) : null;

    // Check cooldown (24 hours)
    if (lastDaily && now.getTime() - lastDaily.getTime() < 24 * 60 * 60 * 1000) {
      const cooldown = 24 * 60 * 60 * 1000 - (now.getTime() - lastDaily.getTime());
      return { amount: 0, streak: user.dailyStreak, cooldown };
    }

    // Calculate streak
    let newStreak = 1;
    if (lastDaily) {
      const timeDiff = now.getTime() - lastDaily.getTime();
      const daysDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
      
      if (daysDiff === 1) {
        newStreak = user.dailyStreak + 1;
      } else if (daysDiff > 1) {
        newStreak = 1; // Reset streak
      }
    }

    // Calculate reward based on streak
    const baseReward = 500;
    const streakBonus = Math.min(newStreak * 50, 1000); // Max 1000 bonus
    const amount = Math.floor((baseReward + streakBonus) * user.multiplier);

    await db.query(
      `UPDATE economy_users 
       SET coins = coins + $3, last_daily = $4, daily_streak = $5, total_earned = total_earned + $3
       WHERE user_id = $1 AND guild_id = $2`,
      [userId, guildId, amount, now, newStreak]
    );

    await this.logTransaction(userId, guildId, 'daily', amount, `Daily reward (streak: ${newStreak})`);

    return { amount, streak: newStreak };
  }

  public async weeklyReward(userId: string, guildId: string): Promise<{ amount: number; cooldown?: number }> {
    const user = await this.getUser(userId, guildId);
    const now = new Date();
    const lastWeekly = user.lastWeekly ? new Date(user.lastWeekly) : null;

    // Check cooldown (7 days)
    if (lastWeekly && now.getTime() - lastWeekly.getTime() < 7 * 24 * 60 * 60 * 1000) {
      const cooldown = 7 * 24 * 60 * 60 * 1000 - (now.getTime() - lastWeekly.getTime());
      return { amount: 0, cooldown };
    }

    const amount = Math.floor(5000 * user.multiplier);

    await db.query(
      `UPDATE economy_users 
       SET coins = coins + $3, last_weekly = $4, total_earned = total_earned + $3
       WHERE user_id = $1 AND guild_id = $2`,
      [userId, guildId, amount, now]
    );

    await this.logTransaction(userId, guildId, 'weekly', amount, 'Weekly reward');

    return { amount };
  }

  public async work(userId: string, guildId: string): Promise<{ amount: number; job: any; streak: number; cooldown?: number }> {
    const user = await this.getUser(userId, guildId);
    const now = new Date();
    const lastWork = user.lastWork ? new Date(user.lastWork) : null;

    // Check cooldown (4 hours)
    if (lastWork && now.getTime() - lastWork.getTime() < 4 * 60 * 60 * 1000) {
      const cooldown = 4 * 60 * 60 * 1000 - (now.getTime() - lastWork.getTime());
      return { amount: 0, job: null, streak: user.workStreak, cooldown };
    }

    // Calculate streak
    let newStreak = 1;
    if (lastWork) {
      const timeDiff = now.getTime() - lastWork.getTime();
      const hoursDiff = Math.floor(timeDiff / (60 * 60 * 1000));
      
      if (hoursDiff <= 8) { // Within 8 hours maintains streak
        newStreak = user.workStreak + 1;
      }
    }

    // Random job
    const job = this.workJobs[Math.floor(Math.random() * this.workJobs.length)];
    
    // Calculate earnings with random factor and streak bonus
    const baseAmount = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
    const streakBonus = Math.min(newStreak * 5, 100); // Max 100 bonus
    const amount = Math.floor((baseAmount + streakBonus) * user.multiplier);

    await db.query(
      `UPDATE economy_users 
       SET coins = coins + $3, last_work = $4, work_streak = $5, total_earned = total_earned + $3
       WHERE user_id = $1 AND guild_id = $2`,
      [userId, guildId, amount, now, newStreak]
    );

    await this.logTransaction(userId, guildId, 'work', amount, `${job.name}: ${job.description}`);

    return { amount, job, streak: newStreak };
  }

  public async deposit(userId: string, guildId: string, amount: number): Promise<{ success: boolean; amount?: number; error?: string }> {
    const user = await this.getUser(userId, guildId);
    
    if (amount <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }

    if (user.coins < amount) {
      return { success: false, error: 'Insufficient coins in wallet' };
    }

    const availableSpace = user.bankLimit - user.bank;
    const actualAmount = Math.min(amount, availableSpace);

    if (actualAmount === 0) {
      return { success: false, error: 'Bank is full' };
    }

    await db.query(
      `UPDATE economy_users 
       SET coins = coins - $3, bank = bank + $3
       WHERE user_id = $1 AND guild_id = $2`,
      [userId, guildId, actualAmount]
    );

    return { success: true, amount: actualAmount };
  }

  public async withdraw(userId: string, guildId: string, amount: number): Promise<{ success: boolean; amount?: number; error?: string }> {
    const user = await this.getUser(userId, guildId);
    
    if (amount <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }

    if (user.bank < amount) {
      return { success: false, error: 'Insufficient coins in bank' };
    }

    await db.query(
      `UPDATE economy_users 
       SET coins = coins + $3, bank = bank - $3
       WHERE user_id = $1 AND guild_id = $2`,
      [userId, guildId, amount]
    );

    return { success: true, amount };
  }

  public async gamble(userId: string, guildId: string, amount: number, game: 'coinflip' | 'dice' | 'slots'): Promise<{ won: boolean; amount: number; multiplier: number; result: any }> {
    const user = await this.getUser(userId, guildId);
    
    if (user.coins < amount) {
      throw new Error('Insufficient coins');
    }

    let won = false;
    let multiplier = 0;
    let result: any = {};

    switch (game) {
      case 'coinflip':
        const flip = Math.random() < 0.5;
        won = flip;
        multiplier = won ? 1.8 : 0;
        result = { flip: flip ? 'heads' : 'tails' };
        break;

      case 'dice':
        const roll = Math.floor(Math.random() * 6) + 1;
        won = roll >= 4; // 4, 5, 6 win
        multiplier = won ? (roll === 6 ? 5 : roll === 5 ? 3 : 1.5) : 0;
        result = { roll };
        break;

      case 'slots':
        const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎'];
        const slot1 = symbols[Math.floor(Math.random() * symbols.length)];
        const slot2 = symbols[Math.floor(Math.random() * symbols.length)];
        const slot3 = symbols[Math.floor(Math.random() * symbols.length)];
        
        if (slot1 === slot2 && slot2 === slot3) {
          won = true;
          multiplier = slot1 === '💎' ? 10 : slot1 === '🔔' ? 5 : 3;
        } else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
          won = true;
          multiplier = 1.2;
        }
        
        result = { slots: [slot1, slot2, slot3] };
        break;
    }

    const winAmount = Math.floor(amount * multiplier);
    const netGain = winAmount - amount;

    await db.query(
      `UPDATE economy_users 
       SET coins = coins + $3
       WHERE user_id = $1 AND guild_id = $2`,
      [userId, guildId, netGain]
    );

    await this.logTransaction(userId, guildId, 'gamble', netGain, `${game} - ${won ? 'Won' : 'Lost'}`);

    return { won, amount: Math.abs(netGain), multiplier, result };
  }

  public async buyItem(userId: string, guildId: string, itemId: string, quantity: number = 1): Promise<{ success: boolean; item?: ShopItem; error?: string }> {
    const item = await this.getShopItem(itemId);
    if (!item || !item.enabled) {
      return { success: false, error: 'Item not found or disabled' };
    }

    if (item.stock < quantity && item.stock !== -1) {
      return { success: false, error: 'Insufficient stock' };
    }

    const totalCost = item.price * quantity;
    const user = await this.getUser(userId, guildId);

    if (user.coins < totalCost) {
      return { success: false, error: 'Insufficient coins' };
    }

    // Check requirements
    if (item.requirements && !await this.checkRequirements(userId, guildId, item.requirements)) {
      return { success: false, error: 'Requirements not met' };
    }

    await db.transaction(async (client) => {
      // Remove coins
      await client.query(
        'UPDATE economy_users SET coins = coins - $3, total_spent = total_spent + $3 WHERE user_id = $1 AND guild_id = $2',
        [userId, guildId, totalCost]
      );

      // Update stock
      if (item.stock !== -1) {
        await client.query(
          'UPDATE shop_items SET stock = stock - $2 WHERE id = $1',
          [itemId, quantity]
        );
      }

      // Add to inventory
      await client.query(
        `INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, guild_id, item_id) 
         DO UPDATE SET quantity = user_inventory.quantity + $4`,
        [userId, guildId, itemId, quantity]
      );
    });

    await this.logTransaction(userId, guildId, 'shop', totalCost, `Bought ${quantity}x ${item.name}`, undefined, undefined, itemId);

    // Apply item effects (e.g., roles, multipliers)
    await this.applyItemEffects(userId, guildId, item, quantity);

    return { success: true, item };
  }

  public async getLeaderboard(guildId: string, type: 'coins' | 'bank' | 'total', limit: number = 10): Promise<any[]> {
    const orderBy = type === 'total' ? '(coins + bank)' : type;
    
    const result = await db.query(
      `SELECT user_id, coins, bank, (coins + bank) as total 
       FROM economy_users 
       WHERE guild_id = $1 
       ORDER BY ${orderBy} DESC 
       LIMIT $2`,
      [guildId, limit]
    );

    return result.rows;
  }

  public async createShopItem(guildId: string, item: Partial<ShopItem>): Promise<string> {
    const result = await db.query(
      `INSERT INTO shop_items (guild_id, name, description, price, type, role_id, emoji, stock, max_stock, requirements, effects)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        guildId,
        item.name,
        item.description,
        item.price,
        item.type,
        item.roleId,
        item.emoji,
        item.stock || -1,
        item.maxStock || -1,
        JSON.stringify(item.requirements || {}),
        JSON.stringify(item.effects || {})
      ]
    );

    return result.rows[0].id;
  }

  public async getShop(guildId: string): Promise<ShopItem[]> {
    const result = await db.query(
      'SELECT * FROM shop_items WHERE guild_id = $1 AND enabled = true ORDER BY price ASC',
      [guildId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      guildId: row.guild_id,
      name: row.name,
      description: row.description,
      price: row.price,
      type: row.type,
      roleId: row.role_id,
      emoji: row.emoji,
      stock: row.stock,
      maxStock: row.max_stock,
      enabled: row.enabled,
      requirements: row.requirements,
      effects: row.effects,
      createdAt: row.created_at,
    }));
  }

  private async getShopItem(itemId: string): Promise<ShopItem | null> {
    const result = await db.query(
      'SELECT * FROM shop_items WHERE id = $1',
      [itemId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      guildId: row.guild_id,
      name: row.name,
      description: row.description,
      price: row.price,
      type: row.type,
      roleId: row.role_id,
      emoji: row.emoji,
      stock: row.stock,
      maxStock: row.max_stock,
      enabled: row.enabled,
      requirements: row.requirements,
      effects: row.effects,
      createdAt: row.created_at,
    };
  }

  private async checkRequirements(userId: string, guildId: string, requirements: any): Promise<boolean> {
    // Implement requirement checking logic (level, items, etc.)
    return true; // Simplified for now
  }

  private async applyItemEffects(userId: string, guildId: string, item: ShopItem, quantity: number): Promise<void> {
    // Apply item effects (roles, multipliers, etc.)
    if (item.type === 'role' && item.roleId) {
      // This would require guild context to apply roles
      // Implementation depends on how you handle role application
    }
  }

  private async logTransaction(
    userId: string,
    guildId: string,
    type: Transaction['type'],
    amount: number,
    description: string,
    toUser?: string,
    fromUser?: string,
    itemId?: string
  ): Promise<void> {
    await db.query(
      `INSERT INTO economy_transactions (user_id, guild_id, type, amount, description, to_user, from_user, item_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, guildId, type, amount, description, toUser, fromUser, itemId]
    );
  }
}

export const economyHandler = EconomyHandler.getInstance();