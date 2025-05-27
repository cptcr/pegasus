// src/commands/giveaway/giveaway.ts - Fixed Giveaway Command
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';
import { Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create and manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new giveaway')
        .addStringOption(option =>
          option.setName('prize')
            .setDescription('What is being given away')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('duration')
            .setDescription('Duration in minutes')
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(43200) // 30 days
        )
        .addIntegerOption(option =>
          option.setName('winners')
            .setDescription('Number of winners')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Giveaway title')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Giveaway description')
            .setRequired(false)
        )
        .addRoleOption(option =>
          option.setName('required_role')
            .setDescription('Required role to enter')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('required_level')
            .setDescription('Required level to enter')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(100)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('End a giveaway early')
        .addIntegerOption(option =>
          option.setName('id')
            .setDescription('Giveaway ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reroll')
        .setDescription('Reroll giveaway winners')
        .addIntegerOption(option =>
          option.setName('id')
            .setDescription('Giveaway ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List active giveaways')
    ),
  category: 'giveaway',
  cooldown: 30,
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'create':
          await handleCreateGiveaway(interaction, client);
          break;
        case 'end':
          await handleEndGiveaway(interaction, client);
          break;
        case 'reroll':
          await handleRerollGiveaway(interaction, client);
          break;
        case 'list':
          await handleListGiveaways(interaction, client);
          break;
        default:
          await interaction.reply({
            content: '❌ Unknown subcommand.',
            ephemeral: true
          });
      }
    } catch (error) {
      client.logger.error('❌ Error in giveaway command:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing the giveaway command.',
          ephemeral: true
        });
      }
    }
  },
};

async function handleCreateGiveaway(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
  const prize = interaction.options.getString('prize', true);
  const duration = interaction.options.getInteger('duration', true);
  const winners = interaction.options.getInteger('winners') || 1;
  const title = interaction.options.getString('title') || `🎉 ${prize} Giveaway`;
  const description = interaction.options.getString('description');
  const requiredRole = interaction.options.getRole('required_role');
  const requiredLevel = interaction.options.getInteger('required_level');

  if (duration < Config.GIVEAWAY.MIN_DURATION / 60000) {
    return interaction.reply({
      content: `❌ Giveaway duration must be at least ${Config.GIVEAWAY.MIN_DURATION / 60000} minutes.`,
      ephemeral: true
    });
  }

  if (duration > Config.GIVEAWAY.MAX_DURATION / 60000) {
    return interaction.reply({
      content: `❌ Giveaway duration cannot exceed ${Config.GIVEAWAY.MAX_DURATION / 60000 / 1440} days.`,
      ephemeral: true
    });
  }

  await interaction.deferReply();

  const result = await client.giveawayManager.createGiveaway(
    interaction.guild!, 
    {
      title,
      description: description || undefined,
      prize,
      duration: duration * 60000, // Convert minutes to milliseconds
      winners,
      creatorId: interaction.user.id,
      channelId: interaction.channelId,
      requirements: {
        roleRequired: requiredRole?.id,
        levelRequired: requiredLevel || undefined,
      }
    }
  );

  if (result.success) {
    await interaction.editReply({
      content: `✅ Giveaway created successfully!\n🎁 **${prize}** - ${winners} winner(s)\n⏰ Duration: ${duration} minutes`
    });
  } else {
    await interaction.editReply({
      content: `❌ Failed to create giveaway: ${result.error}`
    });
  }
}

async function handleEndGiveaway(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
  const giveawayId = interaction.options.getInteger('id', true);

  await interaction.deferReply();

  const result = await client.giveawayManager.endGiveaway(giveawayId, interaction.user.id);

  if (result.success) {
    const winnerText = result.winners && result.winners.length > 0
      ? `🎉 Winners: ${result.winners.map((w: any) => w.tag).join(', ')}`
      : '😔 No valid entries found.';

    await interaction.editReply({
      content: `✅ Giveaway #${giveawayId} has been ended.\n${winnerText}`
    });
  } else {
    await interaction.editReply({
      content: `❌ Failed to end giveaway: ${result.error}`
    });
  }
}

async function handleRerollGiveaway(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
  const giveawayId = interaction.options.getInteger('id', true);

  await interaction.deferReply();

  const result = await client.giveawayManager.rerollGiveaway(giveawayId, interaction.user.id);

  if (result.success) {
    const winnerText = result.winners && result.winners.length > 0
      ? `🎉 New Winners: ${result.winners.map((w: any) => w.tag).join(', ')}`
      : '😔 No valid entries found for reroll.';

    await interaction.editReply({
      content: `✅ Giveaway #${giveawayId} has been rerolled.\n${winnerText}`
    });
  } else {
    await interaction.editReply({
      content: `❌ Failed to reroll giveaway: ${result.error}`
    });
  }
}

async function handleListGiveaways(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
  await interaction.deferReply();

  const activeGiveaways = await client.giveawayManager.getActiveGiveaways(interaction.guild!.id);

  if (activeGiveaways.length === 0) {
    return interaction.editReply({
      content: '📋 No active giveaways found.'
    });
  }

  const giveawayList = activeGiveaways
    .slice(0, 10) // Limit to 10 for display
    .map((giveaway, index) => {
      const endTime = Math.floor(giveaway.endTime.getTime() / 1000);
      return `**${index + 1}.** ${giveaway.title}\n🎁 Prize: ${giveaway.prize}\n👥 Entries: ${giveaway.entries.length}\n⏰ Ends: <t:${endTime}:R>\n`;
    })
    .join('\n');

  await interaction.editReply({
    content: `📋 **Active Giveaways (${activeGiveaways.length})**\n\n${giveawayList}`
  });
}

export default command;