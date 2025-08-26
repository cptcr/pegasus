import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ChatInputCommandInteraction } from 'discord.js';
import { 
  createMockCommandInteraction, 
  createMockUser, 
  createMockGuildMember,
  createMockGuild 
} from '../../utils/mockDiscord';
import { 
  createMockDb, 
  createMockWarningData,
  createMockGuildMemberData 
} from '../../utils/mockDatabase';
import { expectInteractionReply, mockI18n, cleanupMocks } from '../../utils/testHelpers';

jest.mock('../../../database/connection', () => ({
  db: createMockDb(),
}));

jest.mock('../../../i18n', () => mockI18n());

describe('Warn Command', () => {
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
  
  describe('/warn create', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand = jest.fn().mockReturnValue('create');
    });
    
    it('should create a warning for a user', async () => {
      const targetUser = createMockUser({ id: '999999999999999999' });
      const targetMember = createMockGuildMember({ user: targetUser });
      
      mockInteraction.options.getUser = jest.fn().mockReturnValue(targetUser);
      mockInteraction.options.getMember = jest.fn().mockReturnValue(targetMember);
      mockInteraction.options.getString = jest.fn()
        .mockReturnValueOnce('Spamming')
        .mockReturnValueOnce('Repeatedly sending the same message');
      mockInteraction.options.getInteger = jest.fn().mockReturnValue(1);
      
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.returning.mockResolvedValue([createMockWarningData({
        userId: targetUser.id,
        reason: 'Spamming',
        severity: 1,
      })]);
      
      const { execute } = await import('../../../commands/moderation/warn');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall).toHaveProperty('embeds');
      expect(replyCall.embeds[0].data.title).toContain('Warning Issued');
    });
    
    it('should prevent warning users with higher roles', async () => {
      const targetUser = createMockUser({ id: '999999999999999999' });
      const targetMember = createMockGuildMember({ 
        user: targetUser,
        roles: {
          cache: new Map(),
          highest: { position: 10, id: '111', name: 'Admin' },
          add: jest.fn(),
          remove: jest.fn(),
        } as any,
      });
      
      mockInteraction.member = createMockGuildMember({
        roles: {
          cache: new Map(),
          highest: { position: 5, id: '222', name: 'Moderator' },
          add: jest.fn(),
          remove: jest.fn(),
        } as any,
      });
      
      mockInteraction.options.getUser = jest.fn().mockReturnValue(targetUser);
      mockInteraction.options.getMember = jest.fn().mockReturnValue(targetMember);
      mockInteraction.options.getString = jest.fn().mockReturnValue('Test reason');
      
      const { execute } = await import('../../../commands/moderation/warn');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('higher role'),
          ephemeral: true,
        })
      );
    });
    
    it('should handle invalid warning level', async () => {
      const targetUser = createMockUser({ id: '999999999999999999' });
      const targetMember = createMockGuildMember({ user: targetUser });
      
      mockInteraction.options.getUser = jest.fn().mockReturnValue(targetUser);
      mockInteraction.options.getMember = jest.fn().mockReturnValue(targetMember);
      mockInteraction.options.getString = jest.fn().mockReturnValue('Test reason');
      mockInteraction.options.getInteger = jest.fn().mockReturnValue(11);
      
      const { execute } = await import('../../../commands/moderation/warn');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Invalid warning level'),
          ephemeral: true,
        })
      );
    });
  });
  
  describe('/warn view', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand = jest.fn().mockReturnValue('view');
    });
    
    it('should display warnings for a user', async () => {
      const targetUser = createMockUser({ id: '999999999999999999' });
      
      mockInteraction.options.getUser = jest.fn().mockReturnValue(targetUser);
      
      const mockWarnings = [
        createMockWarningData({ 
          userId: targetUser.id, 
          reason: 'Warning 1',
          severity: 1,
        }),
        createMockWarningData({ 
          userId: targetUser.id, 
          reason: 'Warning 2',
          severity: 2,
        }),
      ];
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.execute.mockResolvedValue(mockWarnings);
      
      const { execute } = await import('../../../commands/moderation/warn');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall).toHaveProperty('embeds');
      expect(replyCall.embeds[0].data.fields).toHaveLength(2);
    });
    
    it('should show message when user has no warnings', async () => {
      const targetUser = createMockUser({ id: '999999999999999999' });
      
      mockInteraction.options.getUser = jest.fn().mockReturnValue(targetUser);
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.execute.mockResolvedValue([]);
      
      const { execute } = await import('../../../commands/moderation/warn');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('no warnings'),
        })
      );
    });
  });
  
  describe('/warn lookup', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand = jest.fn().mockReturnValue('lookup');
    });
    
    it('should display specific warning details', async () => {
      mockInteraction.options.getString = jest.fn().mockReturnValue('123');
      
      const mockWarning = createMockWarningData({
        id: '123',
        reason: 'Test warning',
        severity: 2,
        userId: '999999999999999999',
        moderatorId: '888888888888888888',
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([mockWarning]);
      
      const { execute } = await import('../../../commands/moderation/warn');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall).toHaveProperty('embeds');
      expect(replyCall.embeds[0].data.title).toContain('Warning #123');
    });
    
    it('should handle non-existent warning ID', async () => {
      mockInteraction.options.getString = jest.fn().mockReturnValue('999');
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([]);
      
      const { execute } = await import('../../../commands/moderation/warn');
      await execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Warning not found'),
          ephemeral: true,
        })
      );
    });
  });
  
  describe('/warn edit', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand = jest.fn().mockReturnValue('edit');
    });
    
    it('should show modal for editing warning', async () => {
      mockInteraction.options.getString = jest.fn().mockReturnValue('123');
      
      const mockWarning = createMockWarningData({
        id: '123',
        reason: 'Original reason',
        severity: 1,
      });
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockResolvedValue([mockWarning]);
      
      mockInteraction.showModal = jest.fn();
      
      const { execute } = await import('../../../commands/moderation/warn');
      await execute(mockInteraction);
      
      expect(mockInteraction.showModal).toHaveBeenCalled();
      const modalCall = mockInteraction.showModal.mock.calls[0][0];
      expect(modalCall.data.custom_id).toContain('edit_warning');
    });
  });
});