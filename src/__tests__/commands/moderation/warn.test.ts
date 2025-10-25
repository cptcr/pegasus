import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  createMockCommandInteraction,
  createMockGuild,
  createMockUser,
} from '../../../test-utils/mockDiscord';

type WarningServiceMock = {
  createWarning: jest.Mock;
  getWarningEmbed: jest.Mock;
  deleteAutomation: jest.Mock;
};

type WarningRepositoryMock = {
  getWarningById: jest.Mock;
  getUserWarnings: jest.Mock;
  getUserWarningStats: jest.Mock;
  getGuildAutomations: jest.Mock;
};

const mockWarningService: WarningServiceMock = {
  createWarning: jest.fn(),
  getWarningEmbed: jest.fn(),
  deleteAutomation: jest.fn(),
};

const mockWarningRepository: WarningRepositoryMock = {
  getWarningById: jest.fn(),
  getUserWarnings: jest.fn(),
  getUserWarningStats: jest.fn(),
  getGuildAutomations: jest.fn(),
};

const serviceMock = mockWarningService as any;
const repositoryMock = mockWarningRepository as any;

jest.mock('../../../services/warningService', () => ({
  warningService: mockWarningService,
}));

jest.mock('../../../repositories/warningRepository', () => ({
  warningRepository: mockWarningRepository,
}));

jest.mock('../../../i18n', () => ({
  t: (key: string) => key,
}));

describe('Warn command', () => {
let interaction: ReturnType<typeof createMockCommandInteraction>;
  let execute: typeof import('../../../commands/moderation/warn').execute;

  beforeEach(async () => {
    jest.clearAllMocks();
    interaction = createMockCommandInteraction();
    interaction.guild = createMockGuild();
    const module = await import('../../../commands/moderation/warn');
    execute = module.execute;
  });

  it('rejects when used outside of a guild', async () => {
    interaction.guild = null;

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'common.guildOnly',
        ephemeral: true,
      })
    );
  });

  it('creates a warning for a user', async () => {
    const targetUser = createMockUser({ id: 'target', bot: false } as any);
    const sendMock = jest.fn();
    sendMock.mockReturnValue(Promise.resolve(undefined));
    (targetUser as any).send = sendMock;
    interaction.options.getSubcommand.mockReturnValue('create');
    interaction.options.getUser.mockReturnValue(targetUser);
    interaction.options.getString
      .mockImplementationOnce(() => 'Test Title')
      .mockImplementationOnce(() => 'Description');
    interaction.options.getInteger.mockReturnValue(2);
    interaction.options.getAttachment.mockReturnValue({ url: 'https://example.com/proof.png' } as any);

    serviceMock.createWarning.mockResolvedValueOnce({ warnId: 'W123' });
    await execute(interaction);

    expect(mockWarningService.createWarning).toHaveBeenCalledWith(
      interaction.guild,
      targetUser,
      interaction.user,
      'Test Title',
      'Description',
      2,
      'https://example.com/proof.png'
    );
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows warning details when viewing warnings', async () => {
    const targetUser = createMockUser({ id: 'target' } as any);
    interaction.options.getSubcommand.mockReturnValue('view');
    interaction.options.getUser.mockReturnValue(targetUser);

    repositoryMock.getUserWarnings.mockResolvedValueOnce([
      {
        warnId: 'W1',
        guildId: interaction.guild!.id,
        title: 'Warning title',
        description: 'Warning description',
        level: 1,
        createdAt: new Date(),
      },
    ]);
    repositoryMock.getUserWarningStats.mockResolvedValueOnce({ count: 1, totalLevel: 1 });

    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith({
      embeds: expect.any(Array),
    });
  });

  it('returns not found when looking up missing warning', async () => {
    interaction.options.getSubcommand.mockReturnValue('lookup');
    interaction.options.getString.mockReturnValue('W999');
    repositoryMock.getWarningById.mockResolvedValueOnce(null);

    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('commands.warn.subcommands.lookup.notFound'),
      })
    );
  });

  it('handles automation view subcommand', async () => {
    interaction.options.getSubcommandGroup.mockReturnValue('automation');
    interaction.options.getSubcommand.mockReturnValue('view');
    repositoryMock.getGuildAutomations.mockResolvedValueOnce([]);

    await execute(interaction);

    expect(mockWarningRepository.getGuildAutomations).toHaveBeenCalledWith(interaction.guild!.id);
    expect(interaction.editReply).toHaveBeenCalled();
  });
});
