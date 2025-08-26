import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  createMockDb,
  createMockTransaction,
  createMockGuildMemberData,
  createMockEconomyTransactionData,
  createMockShopItemData
} from '../utils/mockDatabase';
import { cleanupMocks } from '../utils/testHelpers';

jest.mock('../../database/connection', () => ({
  db: createMockDb(),
}));

describe('EconomyService', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let economyService: any;
  
  beforeEach(async () => {
    mockDb = createMockDb();
    jest.clearAllMocks();
    
    const module = await import('../../services/economyService');
    economyService = new module.EconomyService();
  });
  
  afterEach(() => {
    cleanupMocks();
  });
  
  describe('getBalance', () => {
    it('should return user balance', async () => {
      const memberData = createMockGuildMemberData({
        userId: '123456789012345678',
        balance: 5000,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([memberData]);
      
      const result = await economyService.getBalance(
        '987654321098765432',
        '123456789012345678'
      );
      
      expect(result).toBe(5000);
    });
    
    it('should create new user with default balance', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([]);
      
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.onConflictDoNothing.mockReturnThis();
      mockDb.returning.mockResolvedValue([
        createMockGuildMemberData({ balance: 1000 })
      ]);
      
      const result = await economyService.getBalance(
        '987654321098765432',
        '123456789012345678'
      );
      
      expect(result).toBe(1000);
    });
  });
  
  describe('addBalance', () => {
    it('should add balance to user', async () => {
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = createMockTransaction();
        
        mockTx.update.mockReturnThis();
        mockTx.set.mockReturnThis();
        mockTx.where.mockReturnThis();
        mockTx.returning.mockResolvedValue([
          createMockGuildMemberData({ balance: 1500 })
        ]);
        
        mockTx.insert.mockReturnThis();
        mockTx.values.mockResolvedValue([
          createMockEconomyTransactionData()
        ]);
        
        return await callback(mockTx);
      });
      
      const result = await economyService.addBalance(
        '987654321098765432',
        '123456789012345678',
        500,
        'Test payment'
      );
      
      expect(result.newBalance).toBe(1500);
      expect(result.transaction).toBeDefined();
    });
    
    it('should handle negative amounts', async () => {
      await expect(
        economyService.addBalance(
          '987654321098765432',
          '123456789012345678',
          -100,
          'Invalid'
        )
      ).rejects.toThrow('Amount must be positive');
    });
  });
  
  describe('transferBalance', () => {
    it('should transfer balance between users', async () => {
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = createMockTransaction();
        
        mockTx.select.mockReturnThis();
        mockTx.from.mockReturnThis();
        mockTx.where.mockReturnThis();
        mockTx.execute
          .mockResolvedValueOnce([createMockGuildMemberData({ 
            userId: '111',
            balance: 1000 
          })])
          .mockResolvedValueOnce([createMockGuildMemberData({ 
            userId: '222',
            balance: 500 
          })]);
        
        mockTx.update.mockReturnThis();
        mockTx.set.mockReturnThis();
        mockTx.returning.mockResolvedValue([
          createMockGuildMemberData({ balance: 800 })
        ]);
        
        mockTx.insert.mockReturnThis();
        mockTx.values.mockResolvedValue([
          createMockEconomyTransactionData()
        ]);
        
        return await callback(mockTx);
      });
      
      const result = await economyService.transferBalance(
        '987654321098765432',
        '111',
        '222',
        200
      );
      
      expect(result.success).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalled();
    });
    
    it('should prevent transfer with insufficient funds', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([
        createMockGuildMemberData({ balance: 100 })
      ]);
      
      await expect(
        economyService.transferBalance(
          '987654321098765432',
          '111',
          '222',
          500
        )
      ).rejects.toThrow('Insufficient funds');
    });
  });
  
  describe('claimDaily', () => {
    it('should award daily reward', async () => {
      const memberData = createMockGuildMemberData({
        balance: 1000,
        lastDaily: null,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([memberData]);
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = createMockTransaction();
        
        mockTx.update.mockReturnThis();
        mockTx.set.mockReturnThis();
        mockTx.where.mockReturnThis();
        mockTx.returning.mockResolvedValue([{
          ...memberData,
          balance: 1200,
          lastDaily: new Date(),
        }]);
        
        mockTx.insert.mockReturnThis();
        mockTx.values.mockResolvedValue([
          createMockEconomyTransactionData()
        ]);
        
        return await callback(mockTx);
      });
      
      const result = await economyService.claimDaily(
        '987654321098765432',
        '123456789012345678'
      );
      
      expect(result.amount).toBeGreaterThanOrEqual(100);
      expect(result.amount).toBeLessThanOrEqual(500);
      expect(result.newBalance).toBeGreaterThan(1000);
    });
    
    it('should enforce daily cooldown', async () => {
      const memberData = createMockGuildMemberData({
        balance: 1000,
        lastDaily: new Date(),
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([memberData]);
      
      await expect(
        economyService.claimDaily(
          '987654321098765432',
          '123456789012345678'
        )
      ).rejects.toThrow('already claimed');
    });
  });
  
  describe('work', () => {
    it('should award work reward', async () => {
      const memberData = createMockGuildMemberData({
        balance: 1000,
        lastWork: null,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([memberData]);
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = createMockTransaction();
        
        mockTx.update.mockReturnThis();
        mockTx.set.mockReturnThis();
        mockTx.where.mockReturnThis();
        mockTx.returning.mockResolvedValue([{
          ...memberData,
          balance: 1300,
          lastWork: new Date(),
        }]);
        
        mockTx.insert.mockReturnThis();
        mockTx.values.mockResolvedValue([
          createMockEconomyTransactionData()
        ]);
        
        return await callback(mockTx);
      });
      
      const result = await economyService.work(
        '987654321098765432',
        '123456789012345678'
      );
      
      expect(result.amount).toBeGreaterThanOrEqual(200);
      expect(result.amount).toBeLessThanOrEqual(500);
      expect(result.job).toBeDefined();
    });
    
    it('should enforce work cooldown', async () => {
      const recentWork = new Date();
      recentWork.setHours(recentWork.getHours() - 2);
      
      const memberData = createMockGuildMemberData({
        balance: 1000,
        lastWork: recentWork,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([memberData]);
      
      await expect(
        economyService.work(
          '987654321098765432',
          '123456789012345678'
        )
      ).rejects.toThrow('cooldown');
    });
  });
  
  describe('rob', () => {
    it('should successfully rob another user', async () => {
      const thiefData = createMockGuildMemberData({
        userId: '111',
        balance: 500,
        lastRob: null,
      });
      
      const victimData = createMockGuildMemberData({
        userId: '222',
        balance: 2000,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute
        .mockResolvedValueOnce([thiefData])
        .mockResolvedValueOnce([victimData])
        .mockResolvedValueOnce([]);
      
      Math.random = jest.fn(() => 0.7);
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = createMockTransaction();
        
        mockTx.update.mockReturnThis();
        mockTx.set.mockReturnThis();
        mockTx.where.mockReturnThis();
        mockTx.returning.mockResolvedValue([
          createMockGuildMemberData({ balance: 700 })
        ]);
        
        mockTx.insert.mockReturnThis();
        mockTx.values.mockResolvedValue([
          createMockEconomyTransactionData()
        ]);
        
        return await callback(mockTx);
      });
      
      const result = await economyService.rob(
        '987654321098765432',
        '111',
        '222'
      );
      
      expect(result.success).toBe(true);
      expect(result.amount).toBeGreaterThan(0);
    });
    
    it('should fail rob attempt', async () => {
      const thiefData = createMockGuildMemberData({
        userId: '111',
        balance: 500,
        lastRob: null,
      });
      
      const victimData = createMockGuildMemberData({
        userId: '222',
        balance: 2000,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute
        .mockResolvedValueOnce([thiefData])
        .mockResolvedValueOnce([victimData])
        .mockResolvedValueOnce([]);
      
      Math.random = jest.fn(() => 0.3);
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = createMockTransaction();
        
        mockTx.update.mockReturnThis();
        mockTx.set.mockReturnThis();
        mockTx.where.mockReturnThis();
        mockTx.returning.mockResolvedValue([
          createMockGuildMemberData({ balance: 400 })
        ]);
        
        mockTx.insert.mockReturnThis();
        mockTx.values.mockResolvedValue([
          createMockEconomyTransactionData()
        ]);
        
        return await callback(mockTx);
      });
      
      const result = await economyService.rob(
        '987654321098765432',
        '111',
        '222'
      );
      
      expect(result.success).toBe(false);
      expect(result.penalty).toBeGreaterThan(0);
    });
  });
  
  describe('shop', () => {
    it('should retrieve shop items', async () => {
      const shopItems = [
        createMockShopItemData({ name: 'Item 1', price: 100 }),
        createMockShopItemData({ name: 'Item 2', price: 200 }),
      ];
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.execute.mockResolvedValue(shopItems);
      
      const result = await economyService.getShopItems('987654321098765432');
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Item 1');
    });
    
    it('should purchase shop item', async () => {
      const shopItem = createMockShopItemData({
        id: '1',
        name: 'Test Item',
        price: 500,
        stock: 10,
      });
      
      const memberData = createMockGuildMemberData({
        balance: 1000,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute
        .mockResolvedValueOnce([shopItem])
        .mockResolvedValueOnce([memberData]);
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = createMockTransaction();
        
        mockTx.update.mockReturnThis();
        mockTx.set.mockReturnThis();
        mockTx.where.mockReturnThis();
        mockTx.returning.mockResolvedValue([
          createMockGuildMemberData({ balance: 500 })
        ]);
        
        mockTx.insert.mockReturnThis();
        mockTx.values.mockResolvedValue([
          { id: '1', userId: '123456789012345678', itemId: '1' }
        ]);
        
        return await callback(mockTx);
      });
      
      const result = await economyService.purchaseItem(
        '987654321098765432',
        '123456789012345678',
        '1'
      );
      
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(500);
    });
    
    it('should prevent purchase with insufficient funds', async () => {
      const shopItem = createMockShopItemData({
        id: '1',
        price: 1000,
      });
      
      const memberData = createMockGuildMemberData({
        balance: 500,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute
        .mockResolvedValueOnce([shopItem])
        .mockResolvedValueOnce([memberData]);
      
      await expect(
        economyService.purchaseItem(
          '987654321098765432',
          '123456789012345678',
          '1'
        )
      ).rejects.toThrow('Insufficient funds');
    });
  });
});