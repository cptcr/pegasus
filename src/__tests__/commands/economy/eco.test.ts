import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ChatInputCommandInteraction } from 'discord.js';
import { 
  createMockCommandInteraction, 
  createMockUser, 
  createMockGuildMember 
} from '../../utils/mockDiscord';
import { 
  createMockDb, 
  createMockGuildMemberData,
  createMockEconomyTransactionData 
} from '../../utils/mockDatabase';
import { cleanupMocks, mockI18n } from '../../utils/testHelpers';

jest.mock('../../../database/connection', () => ({
  db: createMockDb(),
}));

jest.mock('../../../i18n', () => mockI18n());

describe('Economy Commands', () => {
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockDb: ReturnType<typeof createMockDb>;
  
  beforeEach(() => {
    mockInteraction = createMockCommandInteraction();
    mockDb = createMockDb();
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    cleanupMocks();
  });
  
  describe('/eco balance', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand = jest.fn().mockReturnValue('balance');
    });
    
    it('should display user balance', async () => {
      const targetUser = createMockUser();
      mockInteraction.options.getUser = jest.fn().mockReturnValue(targetUser);
      
      const memberData = createMockGuildMemberData({
        userId: targetUser.id,
        balance: 5000,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([memberData]);
      
      const { execute } = await import('../../../commands/economy/eco');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall).toHaveProperty('embeds');
      expect(replyCall.embeds[0].data.description).toContain('5000');
    });
    
    it('should show default balance for new users', async () => {
      const targetUser = createMockUser();
      mockInteraction.options.getUser = jest.fn().mockReturnValue(null);
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([]);
      
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.onConflictDoUpdate.mockReturnThis();
      mockDb.returning.mockResolvedValue([createMockGuildMemberData({
        userId: mockInteraction.user.id,
        balance: 1000,
      })]);
      
      const { execute } = await import('../../../commands/economy/eco');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall.embeds[0].data.description).toContain('1000');
    });
  });
  
  describe('/eco daily', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand = jest.fn().mockReturnValue('daily');
    });
    
    it('should award daily reward', async () => {
      const memberData = createMockGuildMemberData({
        userId: mockInteraction.user.id,
        balance: 1000,
        lastDaily: null,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([memberData]);
      
      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.returning.mockResolvedValue([{
        ...memberData,
        balance: 1200,
        lastDaily: new Date(),
      }]);
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = {
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{
            ...memberData,
            balance: 1200,
            lastDaily: new Date(),
          }]),
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockResolvedValue([createMockEconomyTransactionData()]),
        };
        return await callback(mockTx);
      });
      
      const { execute } = await import('../../../commands/economy/eco');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall.embeds[0].data.description).toContain('daily reward');
    });
    
    it('should prevent claiming daily twice', async () => {
      const memberData = createMockGuildMemberData({
        userId: mockInteraction.user.id,
        balance: 1000,
        lastDaily: new Date(),
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([memberData]);
      
      const { execute } = await import('../../../commands/economy/eco');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('already claimed'),
          ephemeral: true,
        })
      );
    });
  });
  
  describe('/eco work', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand = jest.fn().mockReturnValue('work');
    });
    
    it('should award work reward', async () => {
      const memberData = createMockGuildMemberData({
        userId: mockInteraction.user.id,
        balance: 1000,
        lastWork: null,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([memberData]);
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = {
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{
            ...memberData,
            balance: 1300,
            lastWork: new Date(),
          }]),
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockResolvedValue([createMockEconomyTransactionData()]),
        };
        return await callback(mockTx);
      });
      
      const { execute } = await import('../../../commands/economy/eco');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall.embeds[0].data.description).toContain('earned');
    });
    
    it('should enforce work cooldown', async () => {
      const recentWork = new Date();
      recentWork.setHours(recentWork.getHours() - 1);
      
      const memberData = createMockGuildMemberData({
        userId: mockInteraction.user.id,
        balance: 1000,
        lastWork: recentWork,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([memberData]);
      
      const { execute } = await import('../../../commands/economy/eco');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('cooldown'),
          ephemeral: true,
        })
      );
    });
  });
  
  describe('/eco rob', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand = jest.fn().mockReturnValue('rob');
    });
    
    it('should successfully rob another user', async () => {
      const targetUser = createMockUser({ id: '999999999999999999' });
      mockInteraction.options.getUser = jest.fn().mockReturnValue(targetUser);
      
      const thiefData = createMockGuildMemberData({
        userId: mockInteraction.user.id,
        balance: 500,
        lastRob: null,
      });
      
      const victimData = createMockGuildMemberData({
        userId: targetUser.id,
        balance: 2000,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute
        .mockResolvedValueOnce([thiefData])
        .mockResolvedValueOnce([victimData]);
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = {
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          returning: jest.fn()
            .mockResolvedValueOnce([{ ...thiefData, balance: 700, lastRob: new Date() }])
            .mockResolvedValueOnce([{ ...victimData, balance: 1800 }]),
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockResolvedValue([createMockEconomyTransactionData()]),
        };
        return await callback(mockTx);
      });
      
      Math.random = jest.fn().mockReturnValue(0.7);
      
      const { execute } = await import('../../../commands/economy/eco');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall.embeds[0].data.description).toContain('successfully robbed');
    });
    
    it('should fail rob attempt', async () => {
      const targetUser = createMockUser({ id: '999999999999999999' });
      mockInteraction.options.getUser = jest.fn().mockReturnValue(targetUser);
      
      const thiefData = createMockGuildMemberData({
        userId: mockInteraction.user.id,
        balance: 500,
        lastRob: null,
      });
      
      const victimData = createMockGuildMemberData({
        userId: targetUser.id,
        balance: 2000,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute
        .mockResolvedValueOnce([thiefData])
        .mockResolvedValueOnce([victimData]);
      
      Math.random = jest.fn().mockReturnValue(0.3);
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = {
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ 
            ...thiefData, 
            balance: 400,
            lastRob: new Date() 
          }]),
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockResolvedValue([createMockEconomyTransactionData()]),
        };
        return await callback(mockTx);
      });
      
      const { execute } = await import('../../../commands/economy/eco');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall.embeds[0].data.description).toContain('caught');
    });
    
    it('should prevent robbing users with low balance', async () => {
      const targetUser = createMockUser({ id: '999999999999999999' });
      mockInteraction.options.getUser = jest.fn().mockReturnValue(targetUser);
      
      const thiefData = createMockGuildMemberData({
        userId: mockInteraction.user.id,
        balance: 500,
        lastRob: null,
      });
      
      const victimData = createMockGuildMemberData({
        userId: targetUser.id,
        balance: 50,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute
        .mockResolvedValueOnce([thiefData])
        .mockResolvedValueOnce([victimData]);
      
      const { execute } = await import('../../../commands/economy/eco');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('not enough'),
          ephemeral: true,
        })
      );
    });
  });
});