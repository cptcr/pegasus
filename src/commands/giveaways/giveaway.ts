import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import { giveawayHandler } from '../../handlers/giveaway';
import { createSuccessEmbed, createErrorEmbed, parseDuration } from '../../utils/helpers';
import { GiveawayRequirements, GiveawayBonusEntries } from '../../types';

export const data = new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new giveaway')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Title of the giveaway')
            .setRequired(true)
            .setMaxLength(255)
        )
        .addStringOption(option =>
          option.setName('prize')
            .setDescription('Prize for the giveaway')
            .setRequired(true)
            .setMaxLength(500)
        )
        .addStringOption(option =>
          option.setName('duration')
            .setDescription('Duration of the giveaway (e.g., 1h, 30m, 1d)')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to post the giveaway in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('winners')
            .setDescription('Number of winners (default: 1)')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Description of the giveaway')
            .setMaxLength(1000)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption(option =>
          option.setName('giveaway_id')
            .setDescription('ID of the giveaway to end')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reroll')
        .setDescription('Reroll a giveaway to select new winners')
        .addStringOption(option =>
          option.setName('giveaway_id')
            .setDescription('ID of the giveaway to reroll')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('count')
            .setDescription('Number of new winners to select (default: 1)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all giveaways in this server')
        .addBooleanOption(option =>
          option.setName('active_only')
            .setDescription('Show only active giveaways (default: false)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('cancel')
        .setDescription('Cancel a giveaway')
        .addStringOption(option =>
          option.setName('giveaway_id')
            .setDescription('ID of the giveaway to cancel')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('advanced')
        .setDescription('Create an advanced giveaway with requirements and bonuses')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Title of the giveaway')
            .setRequired(true)
            .setMaxLength(255)
        )
        .addStringOption(option =>
          option.setName('prize')
            .setDescription('Prize for the giveaway')
            .setRequired(true)
            .setMaxLength(500)
        )
        .addStringOption(option =>
          option.setName('duration')
            .setDescription('Duration of the giveaway (e.g., 1h, 30m, 1d)')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to post the giveaway in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('winners')
            .setDescription('Number of winners (default: 1)')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('min_level')
            .setDescription('Minimum level required to enter')
            .setMinValue(1)
            .setRequired(false)
        )
        .addRoleOption(option =>
          option.setName('required_role')
            .setDescription('Role required to enter')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('min_account_age')
            .setDescription('Minimum account age in days')
            .setMinValue(1)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('min_join_age')
            .setDescription('Minimum time since joining server in days')
            .setMinValue(1)
            .setRequired(false)
        )
        .addRoleOption(option =>
          option.setName('bonus_role')
            .setDescription('Role that gives bonus entries')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('bonus_entries')
            .setDescription('Number of bonus entries for the bonus role')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('booster_bonus')
            .setDescription('Bonus entries for server boosters')
            .setMinValue(1)
            .setMaxValue(5)
            .setRequired(false)
        )
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleCreate(interaction);
        break;
      case 'end':
        await handleEnd(interaction);
        break;
      case 'reroll':
        await handleReroll(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'cancel':
        await handleCancel(interaction);
        break;
      case 'advanced':
        await handleAdvanced(interaction);
        break;
    }
}

async function handleCreate(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const title = interaction.options.getString('title', true);
  const prize = interaction.options.getString('prize', true);
  const durationStr = interaction.options.getString('duration', true);
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const winners = interaction.options.getInteger('winners') || 1;
  const description = interaction.options.getString('description');

  try {
    const duration = parseDuration(durationStr);
    
    if (duration < 60000) { // 1 minute minimum
      return await interaction.editReply({
        embeds: [createErrorEmbed('Invalid Duration', 'Duration must be at least 1 minute.')],
      });
    }

    if (duration > 30 * 24 * 60 * 60 * 1000) { // 30 days maximum
      return await interaction.editReply({
        embeds: [createErrorEmbed('Invalid Duration', 'Duration cannot exceed 30 days.')],
      });
    }

    if (!channel || channel.type !== ChannelType.GuildText) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('Invalid Channel', 'Please specify a valid text channel.')],
      });
    }

    const giveawayId = await giveawayHandler.createGiveaway(
      interaction.guild.id,
      channel.id,
      interaction.user.id,
      title,
      prize,
      duration,
      winners,
      description || undefined
    );

    if (!giveawayId) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to create giveaway.')],
      });
    }

    await interaction.editReply({
      embeds: [createSuccessEmbed('Giveaway Created', `Giveaway "${title}" has been created in ${channel}!\n\n**ID:** ${giveawayId}`)],
    });
  } catch (error) {
    console.error('Error creating giveaway:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Invalid duration format. Use formats like: 1h, 30m, 1d, 2h30m')],
    });
  }
}

async function handleAdvanced(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const title = interaction.options.getString('title', true);
  const prize = interaction.options.getString('prize', true);
  const durationStr = interaction.options.getString('duration', true);
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const winners = interaction.options.getInteger('winners') || 1;
  
  // Requirements
  const minLevel = interaction.options.getInteger('min_level');
  const requiredRole = interaction.options.getRole('required_role');
  const minAccountAge = interaction.options.getInteger('min_account_age');
  const minJoinAge = interaction.options.getInteger('min_join_age');
  
  // Bonuses
  const bonusRole = interaction.options.getRole('bonus_role');
  const bonusEntries = interaction.options.getInteger('bonus_entries');
  const boosterBonus = interaction.options.getInteger('booster_bonus');

  try {
    const duration = parseDuration(durationStr);
    
    if (duration < 60000) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('Invalid Duration', 'Duration must be at least 1 minute.')],
      });
    }

    if (duration > 30 * 24 * 60 * 60 * 1000) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('Invalid Duration', 'Duration cannot exceed 30 days.')],
      });
    }

    if (!channel || channel.type !== ChannelType.GuildText) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('Invalid Channel', 'Please specify a valid text channel.')],
      });
    }

    // Build requirements
    const requirements: GiveawayRequirements = {};
    if (minLevel) requirements.minLevel = minLevel;
    if (requiredRole) requirements.requiredRoles = [requiredRole.id];
    if (minAccountAge) requirements.minAccountAge = minAccountAge * 24 * 60 * 60 * 1000;
    if (minJoinAge) requirements.minJoinAge = minJoinAge * 24 * 60 * 60 * 1000;

    // Build bonus entries
    const bonusConfig: GiveawayBonusEntries = {};
    if (bonusRole && bonusEntries) {
      bonusConfig.roles = { [bonusRole.id]: bonusEntries };
    }
    if (boosterBonus) bonusConfig.boosts = boosterBonus;

    const giveawayId = await giveawayHandler.createGiveaway(
      interaction.guild.id,
      channel.id,
      interaction.user.id,
      title,
      prize,
      duration,
      winners,
      undefined,
      requirements,
      bonusConfig
    );

    if (!giveawayId) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to create giveaway.')],
      });
    }

    let description = `Advanced giveaway "${title}" has been created in ${channel}!\n\n**ID:** ${giveawayId}`;
    
    if (Object.keys(requirements).length > 0) {
      description += '\n\n**Requirements:**';
      if (minLevel) description += `\n• Minimum level: ${minLevel}`;
      if (requiredRole) description += `\n• Required role: ${requiredRole}`;
      if (minAccountAge) description += `\n• Account age: ${minAccountAge} days`;
      if (minJoinAge) description += `\n• Server join age: ${minJoinAge} days`;
    }

    if (Object.keys(bonusConfig).length > 0) {
      description += '\n\n**Bonus Entries:**';
      if (bonusRole && bonusEntries) description += `\n• ${bonusRole}: +${bonusEntries} entries`;
      if (boosterBonus) description += `\n• Server boosters: +${boosterBonus} entries`;
    }

    await interaction.editReply({
      embeds: [createSuccessEmbed('Advanced Giveaway Created', description)],
    });
  } catch (error) {
    console.error('Error creating advanced giveaway:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Invalid duration format. Use formats like: 1h, 30m, 1d, 2h30m')],
    });
  }
}

async function handleEnd(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const giveawayId = interaction.options.getString('giveaway_id', true);

  const result = await giveawayHandler.endGiveaway(giveawayId, true);

  if (!result.success) {
    return await interaction.editReply({
      embeds: [createErrorEmbed('Error', result.message)],
    });
  }

  await interaction.editReply({
    embeds: [createSuccessEmbed('Giveaway Ended', result.message)],
  });
}

async function handleReroll(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const giveawayId = interaction.options.getString('giveaway_id', true);
  const count = interaction.options.getInteger('count') || 1;

  const result = await giveawayHandler.rerollGiveaway(giveawayId, count);

  if (!result.success) {
    return await interaction.editReply({
      embeds: [createErrorEmbed('Error', result.message)],
    });
  }

  await interaction.editReply({
    embeds: [createSuccessEmbed('Giveaway Rerolled', result.message)],
  });
}

async function handleList(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const activeOnly = interaction.options.getBoolean('active_only') || false;
  const giveaways = await giveawayHandler.getGuildGiveaways(interaction.guild.id, activeOnly);

  if (giveaways.length === 0) {
    return await interaction.editReply({
      embeds: [createErrorEmbed('No Giveaways', activeOnly ? 'No active giveaways found.' : 'No giveaways found.')],
    });
  }

  const embed = createSuccessEmbed(
    activeOnly ? 'Active Giveaways' : 'All Giveaways',
    `Found ${giveaways.length} giveaway(s)`
  );

  giveaways.slice(0, 10).forEach(giveaway => {
    const status = giveaway.cancelled ? '❌ Cancelled' : giveaway.ended ? '✅ Ended' : '🎉 Active';
    const endTime = giveaway.ended ? 'Ended' : `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`;
    
    embed.addFields([{
      name: `${status} ${giveaway.title}`,
      value: `**Prize:** ${giveaway.prize}\n**Winners:** ${giveaway.winnerCount}\n**Ends:** ${endTime}\n**ID:** ${giveaway.id}`,
      inline: true
    }]);
  });

  if (giveaways.length > 10) {
    embed.setFooter({ text: `Showing first 10 of ${giveaways.length} giveaways` });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleCancel(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const giveawayId = interaction.options.getString('giveaway_id', true);

  const giveaway = await giveawayHandler.getGiveaway(giveawayId);
  if (!giveaway) {
    return await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Giveaway not found.')],
    });
  }

  if (giveaway.ended || giveaway.cancelled) {
    return await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'This giveaway has already ended or been cancelled.')],
    });
  }

  // Mark as cancelled in database
  try {
    const { Database } = await import('../../database/connection');
    const db = Database.getInstance();
    await db.query(
      'UPDATE giveaways SET cancelled = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [giveawayId]
    );

    await interaction.editReply({
      embeds: [createSuccessEmbed('Giveaway Cancelled', `Giveaway "${giveaway.title}" has been cancelled.`)],
    });
  } catch (error) {
    console.error('Error cancelling giveaway:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to cancel giveaway.')],
    });
  }
}