import { eq, and, desc } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import { auditLogs } from '../database/schema';

export interface AuditLogData {
  action: string;
  userId: string;
  guildId: string;
  targetId?: string;
  details?: unknown;
}

export class AuditLogger {
  async logAction(data: AuditLogData): Promise<void> {
    const db = getDatabase();
    try {
      await db.insert(auditLogs).values({
        action: data.action,
        userId: data.userId,
        guildId: data.guildId,
        targetId: data.targetId,
        details: data.details,
      });
    } catch (error) {
      console.error('Failed to log audit action:', error);
    }
  }

  async getAuditLogs(guildId: string, limit: number = 50) {
    const db = getDatabase();
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.guildId, guildId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getUserAuditLogs(guildId: string, userId: string, limit: number = 50) {
    const db = getDatabase();
    return db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.guildId, guildId), eq(auditLogs.userId, userId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getTargetAuditLogs(guildId: string, targetId: string, limit: number = 50) {
    const db = getDatabase();
    return db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.guildId, guildId), eq(auditLogs.targetId, targetId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
}

export const auditLogger = new AuditLogger();
