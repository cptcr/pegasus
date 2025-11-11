import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { WarningService } from '../../services/warningService';
import { warningRepository } from '../../repositories/warningRepository';
import { auditLogger } from '../../security/audit';
import { ensureUserAndGuildExist } from '../../utils/userUtils';
import { createMockGuild, createMockUser } from '../../test-utils/mockDiscord';
import type { Guild, User } from 'discord.js';

jest.mock('../../repositories/warningRepository', () => ({
  warningRepository: {
    createWarning: jest.fn(),
    getWarningById: jest.fn(),
    updateWarning: jest.fn(),
    getUserWarningStats: jest.fn(),
    getActiveAutomations: jest.fn(),
    updateAutomationLastTriggered: jest.fn(),
  },
}));

jest.mock('../../security/audit', () => ({
  auditLogger: {
    logAction: jest.fn(),
  },
}));

jest.mock('../../utils/userUtils', () => ({
  ensureUserAndGuildExist: jest.fn(),
}));

jest.mock('../../i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    `${key}${params ? `:${JSON.stringify(params)}` : ''}`,
}));

const mockRepo = warningRepository as jest.Mocked<typeof warningRepository>;
const mockAudit = auditLogger as jest.Mocked<typeof auditLogger>;
const mockEnsure = ensureUserAndGuildExist as jest.Mock;

const createWarningRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  warnId: 'W123',
  guildId: 'guild-1',
  userId: 'user-1',
  moderatorId: 'mod-1',
  title: 'Test warning',
  description: 'Test description',
  level: 1,
  proof: null,
  active: true,
  editedAt: null,
  editedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createAutomation = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  automationId: 'AUTO1',
  guildId: 'guild-1',
  name: 'Auto warn',
  description: null,
  triggerType: 'warn_count',
  triggerValue: 3,
  actions: [{ type: 'timeout', duration: 3_600_000 }],
  enabled: true,
  createdBy: 'mod-1',
  lastTriggeredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('WarningService', () => {
  let service: WarningService;
  let guild: Guild;
  let user: User;
  let moderator: User;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WarningService();
    guild = createMockGuild();
    user = createMockUser();
    moderator = createMockUser({ id: 'mod-1' } as any);
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('createWarning', () => {
    it('creates a warning and logs the action', async () => {
      const warning = createWarningRecord();
      mockRepo.createWarning.mockResolvedValueOnce(warning);
      jest.spyOn(service, 'checkAutomations').mockResolvedValueOnce();

      const result = await service.createWarning(
        guild,
        user,
        moderator,
        'Test warning',
        'Details',
        2
      );

      expect(mockEnsure).toHaveBeenCalledTimes(2);
      expect(mockRepo.createWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: guild.id,
          userId: user.id,
          moderatorId: moderator.id,
          title: 'Test warning',
          description: 'Details',
          level: 2,
        })
      );
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'WARN_CREATE',
          userId: moderator.id,
          guildId: guild.id,
          targetId: user.id,
        })
      );
      expect(result).toEqual(warning);
    });
  });

  describe('editWarning', () => {
    it('updates a warning when it exists', async () => {
      const warning = createWarningRecord();
      const updated = createWarningRecord({ title: 'Updated title' });

      mockRepo.getWarningById.mockResolvedValueOnce(warning);
      mockRepo.updateWarning.mockResolvedValueOnce(updated as any);

      const result = await service.editWarning(
        'W123',
        'Updated title',
        'New description',
        moderator
      );

      expect(result).toEqual(updated);
      expect(mockRepo.updateWarning).toHaveBeenCalledWith('W123', {
        title: 'Updated title',
        description: 'New description',
        editedBy: moderator.id,
      });
      expect(mockAudit.logAction).toHaveBeenCalled();
    });

    it('throws when warning does not exist', async () => {
      mockRepo.getWarningById.mockResolvedValueOnce(null as any);

      await expect(
        service.editWarning('missing', 'Updated title', null, moderator)
      ).rejects.toThrow('Warning not found');
    });
  });

  describe('checkAutomations', () => {
    it('triggers automations when threshold met', async () => {
      mockRepo.getUserWarningStats.mockResolvedValueOnce({ count: 3, totalLevel: 6 });
      mockRepo.getActiveAutomations.mockResolvedValueOnce([
        createAutomation({
          triggerType: 'warn_count',
          triggerValue: 2,
          actions: [{ type: 'ban' }],
        }),
      ]);

      await service.checkAutomations(guild, user);

      expect(mockRepo.updateAutomationLastTriggered).toHaveBeenCalled();
    });

    it('skips automations below threshold', async () => {
      mockRepo.getUserWarningStats.mockResolvedValueOnce({ count: 1, totalLevel: 1 });
      mockRepo.getActiveAutomations.mockResolvedValueOnce([
        createAutomation({
          triggerType: 'warn_count',
          triggerValue: 5,
        }),
      ]);

      await service.checkAutomations(guild, user);

      expect(mockRepo.updateAutomationLastTriggered).not.toHaveBeenCalled();
    });
  });
});
