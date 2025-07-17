import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import { loggingHandler, LogCategory } from '../../handlers/logging';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/helpers';

const LOG_CATEGORIES: Array<{ name: LogCategory; description: string }> = [
  { name: 'moderation', description: 'Warnings, bans, kicks, mutes, and other moderation actions' },
  { name: 'message', description: 'Message edits, deletions, and bulk deletions' },
  { name: 'member', description: 'Member joins, leaves, and profile updates' },
  { name: 'voice', description: 'Voice channel joins, leaves, and state changes' },
  { name: 'channel', description: 'Channel creation, deletion, and modifications' },
  { name: 'role', description: 'Role creation, deletion, and permission changes' },
  { name: 'server', description: 'Server settings and configuration changes' },
  { name: 'automod', description: 'Automatic moderation actions and violations' },
  { name: 'economy', description: 'Economy transactions and balance changes' },
  { name: 'tickets', description: 'Ticket creation, updates, and closures' },
  { name: 'giveaways', description: 'Giveaway creation, entries, and winner selection' }
];

export const data = new SlashCommandBuilder()
    .setName('logging')
    .setDescription('Configure server logging settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set a log channel for a specific category')
        .addStringOption(option =>
          option.setName('category')
            .setDescription('Log category to configure')
            .setRequired(true)
            .addChoices(
              ...LOG_CATEGORIES.map(cat => ({ name: cat.name, value: cat.name }))
            )
        )
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to send logs to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable logging for a specific category')
        .addStringOption(option =>
          option.setName('category')
            .setDescription('Log category to disable')
            .setRequired(true)
            .addChoices(
              ...LOG_CATEGORIES.map(cat => ({ name: cat.name, value: cat.name }))
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all configured log channels')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('categories')
        .setDescription('Show all available log categories and their descriptions')
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'set':
        await handleSet(interaction);
        break;
      case 'disable':
        await handleDisable(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'categories':
        await handleCategories(interaction);
        break;
    }
}

async function handleSet(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const category = interaction.options.getString('category', true) as LogCategory;
  const channel = interaction.options.getChannel('channel', true);

  if (!channel || channel.type !== ChannelType.GuildText) {
    return await interaction.editReply({
      embeds: [createErrorEmbed('Invalid Channel', 'Please specify a valid text channel.')],
    });
  }

  const success = await loggingHandler.setLogChannel(interaction.guild.id, category, channel.id);

  if (success) {
    await interaction.editReply({
      embeds: [createSuccessEmbed(
        'Log Channel Set',
        `Successfully set ${channel} as the log channel for **${category}** events.`
      )],
    });
  } else {
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to set log channel.')],
    });
  }
}

async function handleDisable(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const category = interaction.options.getString('category', true) as LogCategory;

  const success = await loggingHandler.disableLogCategory(interaction.guild.id, category);

  if (success) {
    await interaction.editReply({
      embeds: [createSuccessEmbed(
        'Logging Disabled',
        `Successfully disabled logging for **${category}** events.`
      )],
    });
  } else {
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to disable logging category.')],
    });
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const logChannels = await loggingHandler.getLogChannels(interaction.guild.id);

  if (logChannels.length === 0) {
    return await interaction.editReply({
      embeds: [createErrorEmbed('No Log Channels', 'No log channels have been configured.')],
    });
  }

  const embed = createSuccessEmbed('Log Channel Configuration', 'Current logging setup for this server');

  const enabledChannels = logChannels.filter(lc => lc.enabled);
  const disabledChannels = logChannels.filter(lc => !lc.enabled);

  if (enabledChannels.length > 0) {
    embed.addFields([{
      name: '✅ Enabled Categories',
      value: enabledChannels.map(lc => `**${lc.category}**: <#${lc.channelId}>`).join('\n'),
      inline: false
    }]);
  }

  if (disabledChannels.length > 0) {
    embed.addFields([{
      name: '❌ Disabled Categories',
      value: disabledChannels.map(lc => `**${lc.category}**: <#${lc.channelId}> (disabled)`).join('\n'),
      inline: false
    }]);
  }

  // Show categories without specific channels
  const configuredCategories = logChannels.map(lc => lc.category);
  const unconfiguredCategories = LOG_CATEGORIES
    .filter(cat => !configuredCategories.includes(cat.name))
    .map(cat => cat.name);

  if (unconfiguredCategories.length > 0) {
    embed.addFields([{
      name: '⚙️ Using Default Channel',
      value: unconfiguredCategories.join(', ') + '\n\n*These categories will use the general log channel if configured.*',
      inline: false
    }]);
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleCategories(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const embed = createSuccessEmbed('Available Log Categories', 'Configure logging for these event types');

  LOG_CATEGORIES.forEach(category => {
    embed.addFields([{
      name: `📁 ${category.name}`,
      value: category.description,
      inline: false
    }]);
  });

  embed.addFields([{
    name: 'Usage',
    value: '• Use `/logging set` to assign a channel to a category\n• Use `/logging disable` to turn off logging for a category\n• Use `/logging list` to see current configuration',
    inline: false
  }]);

  await interaction.editReply({ embeds: [embed] });
}