import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ChatInputCommandInteraction } from 'discord.js';
import { createMockCommandInteraction } from '../../../test-utils/mockDiscord';

const balanceExecute = jest.fn();
const dailyExecute = jest.fn();
const workExecute = jest.fn();
const robExecute = jest.fn();
const gambleExecute = jest.fn();
const shopExecute = jest.fn();
const shopAutocomplete = jest.fn();

jest.mock('../../../commands/economy/balance', () => ({
  execute: balanceExecute,
}));
jest.mock('../../../commands/economy/daily', () => ({
  execute: dailyExecute,
}));
jest.mock('../../../commands/economy/work', () => ({
  execute: workExecute,
}));
jest.mock('../../../commands/economy/rob', () => ({
  execute: robExecute,
}));
jest.mock('../../../commands/economy/gamble', () => ({
  execute: gambleExecute,
}));
jest.mock('../../../commands/economy/shop', () => ({
  execute: shopExecute,
  autocomplete: shopAutocomplete,
}));

describe('Economy command router', () => {
  let interaction: jest.Mocked<ChatInputCommandInteraction>;
  let execute: typeof import('../../../commands/economy/eco').execute;
  let autocomplete: typeof import('../../../commands/economy/eco').autocomplete;

  beforeEach(async () => {
    jest.clearAllMocks();
    interaction = createMockCommandInteraction();
    const module = await import('../../../commands/economy/eco');
    execute = module.execute;
    autocomplete = module.autocomplete;
  });

  it('routes to balance handler', async () => {
    interaction.options.getSubcommand.mockReturnValue('balance');

    await execute(interaction);

    expect(balanceExecute).toHaveBeenCalledWith(interaction);
  });

  it('routes to daily handler', async () => {
    interaction.options.getSubcommand.mockReturnValue('daily');

    await execute(interaction);

    expect(dailyExecute).toHaveBeenCalledWith(interaction);
  });

  it('routes to work handler', async () => {
    interaction.options.getSubcommand.mockReturnValue('work');

    await execute(interaction);

    expect(workExecute).toHaveBeenCalledWith(interaction);
  });

  it('routes to rob handler', async () => {
    interaction.options.getSubcommand.mockReturnValue('rob');

    await execute(interaction);

    expect(robExecute).toHaveBeenCalledWith(interaction);
  });

  it('routes gambling subcommands to gamble handler', async () => {
    interaction.options.getSubcommandGroup.mockReturnValue('gamble');
    interaction.options.getSubcommand.mockReturnValue('dice');

    await execute(interaction);

    expect(gambleExecute).toHaveBeenCalledWith(interaction);
    expect(balanceExecute).not.toHaveBeenCalled();
  });

  it('routes shop subcommands to shop handler', async () => {
    interaction.options.getSubcommandGroup.mockReturnValue('shop');
    interaction.options.getSubcommand.mockReturnValue('view');

    await execute(interaction);

    expect(shopExecute).toHaveBeenCalledWith(interaction);
    expect(balanceExecute).not.toHaveBeenCalled();
  });

  it('handles autocomplete for shop subcommands', async () => {
    interaction.options.getSubcommandGroup.mockReturnValue('shop');

    await autocomplete(interaction);

    expect(shopAutocomplete).toHaveBeenCalledWith(interaction);
  });

  it('ignores autocomplete for other groups', async () => {
    interaction.options.getSubcommandGroup.mockReturnValue(null);

    await autocomplete(interaction);

    expect(shopAutocomplete).not.toHaveBeenCalled();
  });
});
