import { randomBytes, randomInt } from 'crypto';

/**
 * Cryptographically secure random number utilities
 * Use these instead of Math.random() for any security-critical operations
 */
export class SecureRandom {
  /**
   * Generate a random integer between min and max (inclusive)
   * @param min Minimum value (inclusive)
   * @param max Maximum value (inclusive)
   * @returns Cryptographically secure random integer
   */
  static int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error('Min and max must be integers');
    }
    
    if (min > max) {
      throw new Error('Min must be less than or equal to max');
    }
    
    if (min === max) {
      return min;
    }
    
    // Use crypto.randomInt for the range
    return randomInt(min, max + 1);
  }
  
  /**
   * Generate a random float between 0 and 1 (exclusive)
   * @returns Cryptographically secure random float
   */
  static float(): number {
    // Generate 8 random bytes and convert to a float between 0 and 1
    const bytes = randomBytes(8);
    const value = bytes.readBigUInt64BE(0);
    
    // Convert to float between 0 and 1
    // Max value for 64-bit unsigned int is 2^64 - 1
    return Number(value) / Number(0xFFFFFFFFFFFFFFFFn);
  }
  
  /**
   * Generate a random float between min and max
   * @param min Minimum value
   * @param max Maximum value
   * @returns Cryptographically secure random float
   */
  static floatBetween(min: number, max: number): number {
    if (min > max) {
      throw new Error('Min must be less than or equal to max');
    }
    
    return min + (this.float() * (max - min));
  }
  
  /**
   * Randomly select an element from an array
   * @param array Array to select from
   * @returns Random element from the array
   */
  static choice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot select from empty array');
    }
    
    const index = this.int(0, array.length - 1);
    return array[index];
  }
  
  /**
   * Randomly select multiple unique elements from an array
   * @param array Array to select from
   * @param count Number of elements to select
   * @returns Array of randomly selected unique elements
   */
  static sample<T>(array: T[], count: number): T[] {
    if (count > array.length) {
      throw new Error('Sample size cannot be larger than array length');
    }
    
    if (count <= 0) {
      return [];
    }
    
    // Fisher-Yates shuffle algorithm with secure random
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled.slice(0, count);
  }
  
  /**
   * Shuffle an array in place using Fisher-Yates algorithm
   * @param array Array to shuffle
   * @returns The same array, shuffled
   */
  static shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
  /**
   * Generate a weighted random selection
   * @param items Array of items with weights
   * @returns Selected item
   */
  static weightedChoice<T>(items: Array<{ item: T; weight: number }>): T {
    if (items.length === 0) {
      throw new Error('Cannot select from empty array');
    }
    
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) {
      throw new Error('Total weight must be positive');
    }
    
    const random = this.floatBetween(0, totalWeight);
    let accumulator = 0;
    
    for (const { item, weight } of items) {
      accumulator += weight;
      if (random < accumulator) {
        return item;
      }
    }
    
    // Fallback (should never reach here)
    return items[items.length - 1].item;
  }
  
  /**
   * Generate a random boolean with optional probability
   * @param probability Probability of returning true (0-1)
   * @returns Random boolean
   */
  static boolean(probability: number = 0.5): boolean {
    if (probability < 0 || probability > 1) {
      throw new Error('Probability must be between 0 and 1');
    }
    
    return this.float() < probability;
  }
  
  /**
   * Generate a random string of specified length
   * @param length Length of the string
   * @param charset Character set to use
   * @returns Random string
   */
  static string(
    length: number,
    charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  ): string {
    if (length <= 0) {
      return '';
    }
    
    const chars: string[] = [];
    for (let i = 0; i < length; i++) {
      chars.push(this.choice(charset.split('')));
    }
    
    return chars.join('');
  }
  
  /**
   * Generate a random hexadecimal string
   * @param length Length of the hex string (in characters)
   * @returns Random hex string
   */
  static hex(length: number): string {
    const bytes = Math.ceil(length / 2);
    return randomBytes(bytes).toString('hex').substring(0, length);
  }
  
  /**
   * Generate a UUID v4
   * @returns Random UUID v4
   */
  static uuid(): string {
    const bytes = randomBytes(16);
    
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    
    const hex = bytes.toString('hex');
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32)
    ].join('-');
  }
  
  /**
   * Generate a random color in hex format
   * @returns Random color as hex string
   */
  static color(): string {
    return '#' + this.hex(6);
  }
  
  /**
   * Generate random bytes
   * @param size Number of bytes to generate
   * @returns Buffer containing random bytes
   */
  static bytes(size: number): Buffer {
    return randomBytes(size);
  }
  
  /**
   * Securely compare if a random event should occur based on percentage
   * @param percentage Percentage chance (0-100)
   * @returns True if the event should occur
   */
  static percentage(percentage: number): boolean {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }
    
    return this.float() < (percentage / 100);
  }
  
  /**
   * Generate a random date between two dates
   * @param start Start date
   * @param end End date
   * @returns Random date between start and end
   */
  static date(start: Date, end: Date): Date {
    if (start >= end) {
      throw new Error('Start date must be before end date');
    }
    
    const startTime = start.getTime();
    const endTime = end.getTime();
    const randomTime = this.int(startTime, endTime);
    
    return new Date(randomTime);
  }
}

/**
 * Secure random generator for specific use cases
 */
export class GameRandom extends SecureRandom {
  /**
   * Roll dice with secure random
   * @param sides Number of sides on the die
   * @param count Number of dice to roll
   * @returns Array of dice results
   */
  static rollDice(sides: number = 6, count: number = 1): number[] {
    const results: number[] = [];
    for (let i = 0; i < count; i++) {
      results.push(this.int(1, sides));
    }
    return results;
  }
  
  /**
   * Flip a coin
   * @returns 'heads' or 'tails'
   */
  static coinFlip(): 'heads' | 'tails' {
    return this.boolean() ? 'heads' : 'tails';
  }
  
  /**
   * Draw cards from a deck without replacement
   * @param count Number of cards to draw
   * @param deckSize Size of the deck (default 52)
   * @returns Array of card indices
   */
  static drawCards(count: number, deckSize: number = 52): number[] {
    const deck = Array.from({ length: deckSize }, (_, i) => i);
    return this.sample(deck, count);
  }
  
  /**
   * Generate loot with rarity system
   * @param lootTable Loot table with rarities
   * @returns Selected loot item
   */
  static generateLoot<T>(lootTable: Array<{ item: T; rarity: number }>): T | null {
    // Normalize rarities (higher = more common)
    const items = lootTable.map(({ item, rarity }) => ({
      item,
      weight: 1 / rarity // Invert so lower rarity = lower weight
    }));
    
    return this.weightedChoice(items);
  }
}

/**
 * Lottery system with secure random
 */
export class SecureLottery {
  /**
   * Select lottery winners with weighted entries
   * @param entries Map of user IDs to entry counts
   * @param winnerCount Number of winners to select
   * @returns Array of winner IDs
   */
  static selectWinners(entries: Map<string, number>, winnerCount: number): string[] {
    // Create weighted pool
    const pool: string[] = [];
    for (const [userId, entryCount] of entries) {
      for (let i = 0; i < entryCount; i++) {
        pool.push(userId);
      }
    }
    
    if (pool.length === 0) {
      return [];
    }
    
    // Select unique winners
    const winners = new Set<string>();
    const maxAttempts = pool.length * 10; // Prevent infinite loop
    let attempts = 0;
    
    while (winners.size < winnerCount && attempts < maxAttempts) {
      const winner = SecureRandom.choice(pool);
      winners.add(winner);
      attempts++;
      
      // If we've selected all possible winners, break
      if (winners.size >= new Set(pool).size) {
        break;
      }
    }
    
    return Array.from(winners);
  }
  
  /**
   * Generate a unique lottery ticket number
   * @param length Length of the ticket number
   * @returns Ticket number
   */
  static generateTicket(length: number = 8): string {
    return SecureRandom.string(length, '0123456789');
  }
}

// Export convenience functions
export const secureInt = SecureRandom.int.bind(SecureRandom);
export const secureFloat = SecureRandom.float.bind(SecureRandom);
export const secureChoice = SecureRandom.choice.bind(SecureRandom);
export const secureShuffle = SecureRandom.shuffle.bind(SecureRandom);