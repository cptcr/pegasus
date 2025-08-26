import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  createMockDb,
  createMockTransaction,
  createMockWarningData,
  createMockGuildMemberData,
  createMockGuildData
} from '../utils/mockDatabase';
import { cleanupMocks } from '../utils/testHelpers';

jest.mock('../../database/connection', () => ({
  db: createMockDb(),
}));

describe('WarningService', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let warningService: any;
  
  beforeEach(async () => {
    mockDb = createMockDb();
    jest.clearAllMocks();
    
    const module = await import('../../services/warningService');
    warningService = new module.WarningService();
  });
  
  afterEach(() => {
    cleanupMocks();
  });
  
  describe('createWarning', () => {
    it('should create a new warning', async () => {
      const warningData = {
        guildId: '987654321098765432',
        userId: '123456789012345678',
        moderatorId: '999999999999999999',
        reason: 'Test warning',
        severity: 2,
      };
      
      const expectedWarning = createMockWarningData(warningData);
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = createMockTransaction();
        mockTx.insert.mockReturnThis();
        mockTx.values.mockReturnThis();
        mockTx.returning.mockResolvedValue([expectedWarning]);
        
        mockTx.select.mockReturnThis();
        mockTx.from.mockReturnThis();
        mockTx.where.mockReturnThis();
        mockTx.execute.mockResolvedValue([
          createMockGuildMemberData({ warnings: 0 })
        ]);
        
        mockTx.update.mockReturnThis();
        mockTx.set.mockReturnThis();
        
        return await callback(mockTx);
      });
      
      const result = await warningService.createWarning(warningData);
      
      expect(result).toEqual(expectedWarning);
      expect(mockDb.transaction).toHaveBeenCalled();
    });
    
    it('should trigger automation when threshold is reached', async () => {
      const warningData = {
        guildId: '987654321098765432',
        userId: '123456789012345678',
        moderatorId: '999999999999999999',
        reason: 'Test warning',
        severity: 1,
      };
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = createMockTransaction();
        mockTx.insert.mockReturnThis();
        mockTx.values.mockReturnThis();
        mockTx.returning.mockResolvedValue([createMockWarningData(warningData)]);
        
        mockTx.select.mockReturnThis();
        mockTx.from.mockReturnThis();
        mockTx.where.mockReturnThis();
        mockTx.execute
          .mockResolvedValueOnce([createMockGuildMemberData({ warnings: 2 })])
          .mockResolvedValueOnce([{
            id: '1',
            guildId: '987654321098765432',
            threshold: 3,
            action: 'timeout',
            duration: 3600000,
          }]);
        
        mockTx.update.mockReturnThis();
        mockTx.set.mockReturnThis();
        
        return await callback(mockTx);
      });
      
      const result = await warningService.createWarning(warningData);
      
      expect(result).toBeDefined();
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });
  
  describe('getWarnings', () => {
    it('should retrieve warnings for a user', async () => {
      const userId = '123456789012345678';
      const guildId = '987654321098765432';
      
      const warnings = [
        createMockWarningData({ userId, reason: 'Warning 1' }),
        createMockWarningData({ userId, reason: 'Warning 2' }),
      ];
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.execute.mockResolvedValue(warnings);
      
      const result = await warningService.getWarnings(guildId, userId);
      
      expect(result).toEqual(warnings);
      expect(mockDb.select).toHaveBeenCalled();
    });
    
    it('should filter expired warnings', async () => {
      const userId = '123456789012345678';
      const guildId = '987654321098765432';
      
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 100);
      
      const warnings = [
        createMockWarningData({ userId, reason: 'Active warning' }),
        createMockWarningData({ 
          userId, 
          reason: 'Expired warning',
          expiresAt: expiredDate
        }),
      ];
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.execute.mockResolvedValue(warnings);
      
      const result = await warningService.getActiveWarnings(guildId, userId);
      
      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('Active warning');
    });
  });
  
  describe('updateWarning', () => {
    it('should update an existing warning', async () => {
      const warningId = '123';
      const updates = {
        reason: 'Updated reason',
        severity: 3,
      };
      
      const updatedWarning = createMockWarningData({
        id: warningId,
        ...updates,
      });
      
      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue([updatedWarning]);
      
      const result = await warningService.updateWarning(warningId, updates);
      
      expect(result).toEqual(updatedWarning);
      expect(mockDb.update).toHaveBeenCalled();
    });
    
    it('should throw error for non-existent warning', async () => {
      const warningId = '999';
      const updates = { reason: 'Updated reason' };
      
      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue([]);
      
      await expect(warningService.updateWarning(warningId, updates))
        .rejects.toThrow('Warning not found');
    });
  });
  
  describe('deleteWarning', () => {
    it('should delete a warning', async () => {
      const warningId = '123';
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = createMockTransaction();
        
        mockTx.select.mockReturnThis();
        mockTx.from.mockReturnThis();
        mockTx.where.mockReturnThis();
        mockTx.execute.mockResolvedValue([
          createMockWarningData({ id: warningId })
        ]);
        
        mockTx.delete.mockReturnThis();
        mockTx.returning.mockResolvedValue([{ id: warningId }]);
        
        mockTx.update.mockReturnThis();
        mockTx.set.mockReturnThis();
        
        return await callback(mockTx);
      });
      
      const result = await warningService.deleteWarning(warningId);
      
      expect(result).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });
  
  describe('createAutomation', () => {
    it('should create warning automation', async () => {
      const automationData = {
        guildId: '987654321098765432',
        threshold: 5,
        action: 'ban',
        duration: null,
      };
      
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.returning.mockResolvedValue([{
        id: '1',
        ...automationData,
      }]);
      
      const result = await warningService.createAutomation(automationData);
      
      expect(result).toHaveProperty('id');
      expect(result.threshold).toBe(5);
      expect(result.action).toBe('ban');
    });
    
    it('should validate automation parameters', async () => {
      const invalidData = {
        guildId: '987654321098765432',
        threshold: -1,
        action: 'invalid_action',
      };
      
      await expect(warningService.createAutomation(invalidData))
        .rejects.toThrow('Invalid automation parameters');
    });
  });
  
  describe('checkAutomations', () => {
    it('should trigger timeout automation', async () => {
      const userId = '123456789012345678';
      const guildId = '987654321098765432';
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute
        .mockResolvedValueOnce([createMockGuildMemberData({ warnings: 3 })])
        .mockResolvedValueOnce([{
          id: '1',
          threshold: 3,
          action: 'timeout',
          duration: 3600000,
        }]);
      
      const result = await warningService.checkAutomations(guildId, userId);
      
      expect(result).toEqual({
        triggered: true,
        action: 'timeout',
        duration: 3600000,
      });
    });
    
    it('should trigger ban automation', async () => {
      const userId = '123456789012345678';
      const guildId = '987654321098765432';
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute
        .mockResolvedValueOnce([createMockGuildMemberData({ warnings: 10 })])
        .mockResolvedValueOnce([{
          id: '1',
          threshold: 10,
          action: 'ban',
          duration: null,
        }]);
      
      const result = await warningService.checkAutomations(guildId, userId);
      
      expect(result).toEqual({
        triggered: true,
        action: 'ban',
        duration: null,
      });
    });
    
    it('should not trigger when below threshold', async () => {
      const userId = '123456789012345678';
      const guildId = '987654321098765432';
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute
        .mockResolvedValueOnce([createMockGuildMemberData({ warnings: 1 })])
        .mockResolvedValueOnce([{
          id: '1',
          threshold: 3,
          action: 'timeout',
          duration: 3600000,
        }]);
      
      const result = await warningService.checkAutomations(guildId, userId);
      
      expect(result).toEqual({
        triggered: false,
        action: null,
        duration: null,
      });
    });
  });
});