import { db, createQueryTimer, withTransaction } from '../database';
import { logger } from '../utils/logger';
import { eq, and, gt, gte, lt, lte, desc, asc, sql } from 'drizzle-orm';

export abstract class BaseRepository {
  protected db = db;
  protected logger = logger;

  /**
   * Execute a query with performance monitoring
   */
  protected async executeQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const timer = createQueryTimer(queryName);
    try {
      const result = await queryFn();
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      this.logger.error(`Query ${queryName} failed:`, error);
      throw error;
    }
  }

  /**
   * Execute a transaction with retry logic
   */
  protected async executeTransaction<T>(
    transactionFn: (tx: typeof db) => Promise<T>,
    retries = 3
  ): Promise<T> {
    return withTransaction(transactionFn, retries);
  }

  /**
   * Batch operation helper
   */
  protected async batchOperation<T>(
    items: T[],
    batchSize: number,
    operation: (batch: T[]) => Promise<void>
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await operation(batch);
    }
  }

  /**
   * Safe Discord ID conversion
   */
  protected toDiscordId(value: string | number | bigint): string {
    return value.toString();
  }

  protected fromDiscordId(value: string): bigint {
    return BigInt(value);
  }

  /**
   * Get current timestamp
   */
  protected now(): Date {
    return new Date();
  }

  /**
   * Check if a timestamp has expired
   */
  protected hasExpired(timestamp: Date | null | undefined): boolean {
    if (!timestamp) return false;
    return new Date() > timestamp;
  }
}