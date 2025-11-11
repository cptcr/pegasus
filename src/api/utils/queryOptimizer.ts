import { getDatabase } from '../../database/connection';
import { logger } from '../../utils/logger';
import { sql } from 'drizzle-orm';

interface QueryMetrics {
  query: string;
  count: number;
  totalTime: number;
  avgTime: number;
  lastExecuted: Date;
}

interface ConnectionPoolStats {
  active: number;
  idle: number;
  total: number;
  waitingRequests: number;
}

class QueryOptimizer {
  private metrics: Map<string, QueryMetrics> = new Map();
  private slowQueryThreshold = 100; // milliseconds
  private connectionPool: {
    maxConnections: number;
    currentConnections: number;
    waitQueue: number[];
  } = {
    maxConnections: 20,
    currentConnections: 0,
    waitQueue: [],
  };

  /**
   * Execute query with timing and metrics
   */
  async executeQuery<T>(queryName: string, queryFn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();

    try {
      // Wait if connection pool is full
      if (this.connectionPool.currentConnections >= this.connectionPool.maxConnections) {
        await this.waitForConnection();
      }

      this.connectionPool.currentConnections++;

      const result = await queryFn();

      const executionTime = Date.now() - startTime;
      this.recordMetrics(queryName, executionTime);

      if (executionTime > this.slowQueryThreshold) {
        logger.warn(`Slow query detected: ${queryName} took ${executionTime}ms`);
      }

      return result;
    } catch (error) {
      logger.error(`Query failed: ${queryName}`, error);
      throw error;
    } finally {
      this.connectionPool.currentConnections--;
      this.releaseConnection();
    }
  }

  /**
   * Execute multiple queries in parallel with connection pooling
   */
  async executeBatch<T>(
    queries: Array<{
      name: string;
      fn: () => Promise<T>;
    }>
  ): Promise<T[]> {
    const startTime = Date.now();

    // Limit concurrent queries based on available connections
    const batchSize = Math.min(
      queries.length,
      this.connectionPool.maxConnections - this.connectionPool.currentConnections
    );

    const results: T[] = [];

    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(query => this.executeQuery(query.name, query.fn))
      );
      results.push(...batchResults);
    }

    const totalTime = Date.now() - startTime;
    logger.debug(`Batch query completed: ${queries.length} queries in ${totalTime}ms`);

    return results;
  }

  /**
   * Create optimized pagination query
   */
  createPaginatedQuery(limit: number = 20, offset: number = 0, orderBy?: string) {
    // Use cursor-based pagination for better performance
    if (offset > 1000) {
      logger.warn(`Large offset detected (${offset}). Consider using cursor-based pagination.`);
    }

    return {
      limit,
      offset,
      orderBy: orderBy || 'created_at DESC',
    };
  }

  /**
   * Batch insert optimization
   */
  async batchInsert<T>(table: any, data: T[], chunkSize: number = 100): Promise<void> {
    const db = getDatabase();
    const chunks: T[][] = [];

    // Split data into chunks
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    // Insert chunks in parallel (limited by connection pool)
    await this.executeBatch(
      chunks.map((chunk, index) => ({
        name: `batch_insert_${index}`,
        fn: async () => {
          await db.insert(table).values(chunk).execute();
        },
      }))
    );

    logger.info(`Batch insert completed: ${data.length} records in ${chunks.length} chunks`);
  }

  /**
   * Create indexed query hint
   */
  useIndex(tableName: string, indexName: string): string {
    // PostgreSQL doesn't support index hints directly,
    // but we can log for monitoring
    logger.debug(`Query using index: ${tableName}.${indexName}`);
    return `/* INDEX: ${indexName} */`;
  }

  /**
   * Wait for available connection
   */
  private async waitForConnection(): Promise<void> {
    return new Promise(resolve => {
      this.connectionPool.waitQueue.push(Date.now());

      const checkInterval = setInterval(() => {
        if (this.connectionPool.currentConnections < this.connectionPool.maxConnections) {
          clearInterval(checkInterval);
          this.connectionPool.waitQueue.shift();
          resolve();
        }
      }, 10);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        this.connectionPool.waitQueue.shift();
        resolve();
      }, 5000);
    });
  }

  /**
   * Release connection and process wait queue
   */
  private releaseConnection(): void {
    // Connection released in finally block
  }

  /**
   * Record query metrics
   */
  private recordMetrics(queryName: string, executionTime: number): void {
    const existing = this.metrics.get(queryName);

    if (existing) {
      existing.count++;
      existing.totalTime += executionTime;
      existing.avgTime = existing.totalTime / existing.count;
      existing.lastExecuted = new Date();
    } else {
      this.metrics.set(queryName, {
        query: queryName,
        count: 1,
        totalTime: executionTime,
        avgTime: executionTime,
        lastExecuted: new Date(),
      });
    }
  }

  /**
   * Get query metrics
   */
  getMetrics(): QueryMetrics[] {
    return Array.from(this.metrics.values()).sort((a, b) => b.avgTime - a.avgTime);
  }

  /**
   * Get slow queries
   */
  getSlowQueries(threshold?: number): QueryMetrics[] {
    const limit = threshold || this.slowQueryThreshold;
    return this.getMetrics().filter(m => m.avgTime > limit);
  }

  /**
   * Get connection pool stats
   */
  getPoolStats(): ConnectionPoolStats {
    return {
      active: this.connectionPool.currentConnections,
      idle: this.connectionPool.maxConnections - this.connectionPool.currentConnections,
      total: this.connectionPool.maxConnections,
      waitingRequests: this.connectionPool.waitQueue.length,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Optimize N+1 query problem
   */
  async preventNPlusOne<T, R>(
    parentQuery: () => Promise<T[]>,
    childQuery: (parentIds: any[]) => Promise<R[]>,
    parentKey: string,
    childKey: string
  ): Promise<Map<any, R[]>> {
    // Execute parent query
    const parents = await this.executeQuery('parent_query', parentQuery);

    if (!Array.isArray(parents) || parents.length === 0) {
      return new Map();
    }

    // Extract parent IDs
    const parentIds = parents.map((p: any) => p[parentKey]);

    // Execute single child query with all parent IDs
    const children = await this.executeQuery('child_query', () => childQuery(parentIds));

    // Group children by parent ID
    const childMap = new Map<any, R[]>();

    for (const child of children) {
      const parentId = (child as any)[childKey];
      if (!childMap.has(parentId)) {
        childMap.set(parentId, []);
      }
      childMap.get(parentId)!.push(child);
    }

    return childMap;
  }

  /**
   * Create query plan explanation
   */
  async explainQuery(): Promise<string> {
    try {
      const db = getDatabase();

      // For PostgreSQL, we can use EXPLAIN ANALYZE
      // This is a simplified version - actual implementation would need
      // to extract the SQL from the query builder
      const explanation = await db.execute(sql`EXPLAIN (ANALYZE, BUFFERS) SELECT 1`);

      return JSON.stringify(explanation, null, 2);
    } catch (error) {
      logger.error('Failed to explain query:', error);
      return 'Query explanation not available';
    }
  }
}

// Export singleton instance
export const queryOptimizer = new QueryOptimizer();

// Export optimization utilities
export const QueryUtils = {
  /**
   * Create optimized COUNT query
   */
  async getCount(table: any, whereClause?: any): Promise<number> {
    return queryOptimizer.executeQuery('count_query', async () => {
      const db = getDatabase();
      const query = whereClause
        ? db
            .select({ count: sql<number>`COUNT(*)` })
            .from(table)
            .where(whereClause)
        : db.select({ count: sql<number>`COUNT(*)` }).from(table);

      const result = await query.execute();
      return Number(result[0]?.count) || 0;
    });
  },

  /**
   * Create optimized EXISTS query
   */
  async exists(table: any, whereClause: any): Promise<boolean> {
    return queryOptimizer.executeQuery('exists_query', async () => {
      const db = getDatabase();
      // Using a simpler approach for type safety
      const result = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(table)
        .where(whereClause)
        .execute();

      return (result[0]?.count || 0) > 0;
    });
  },

  /**
   * Bulk upsert with conflict handling
   */
  async upsert(table: any, data: any[], conflictColumns: string[]): Promise<void> {
    return queryOptimizer.executeQuery('upsert_query', async () => {
      const db = getDatabase();

      // PostgreSQL ON CONFLICT syntax
      await db
        .insert(table)
        .values(data)
        .onConflictDoUpdate({
          target: conflictColumns as any,
          set: data[0], // Update with new values
        })
        .execute();
    });
  },
};

/**
 * Query performance monitor middleware
 */
export function monitorQueryPerformance() {
  return {
    before: () => {
      return Date.now();
    },
    after: (queryName: string, startTime: number) => {
      const duration = Date.now() - startTime;
      if (duration > 100) {
        logger.warn(`Slow query: ${queryName} took ${duration}ms`);
      }
    },
  };
}
