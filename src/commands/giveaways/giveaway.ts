import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  ChannelType,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ComponentType
} from 'discord.js';
import { giveawayHandler } from '../../handlers/giveaway';
import { createSuccessEmbed, createErrorEmbed, parseDuration } from '../../utils/helpers';
import { GiveawayRequirements, GiveawayBonusEntries } from '../../types';
import { createEmbedBuilder, EmbedConfig } from '../../handlers/embedBuilder';
import { db } from '../../database/connection';
import { logger } from '../../utils/logger';
import { config } from '../../config';

export const data = new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new giveaway')
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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('builder')
        .setDescription('Create an advanced giveaway with custom embed builder')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption(option =>
          option.setName('giveaway_id')
            .setDescription('ID of the giveaway to end')
            .setRequired(true)
            .setAutocomplete(true)
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
            .setAutocomplete(true)
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
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit an active giveaway')
        .addStringOption(option =>
          option.setName('giveaway_id')
            .setDescription('ID of the giveaway to edit')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('templates')
        .setDescription('Manage giveaway templates')
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Action to perform')
            .setRequired(true)
            .addChoices(
              { name: 'List', value: 'list' },
              { name: 'Create', value: 'create' },
              { name: 'Delete', value: 'delete' },
              { name: 'Use', value: 'use' }
            )
        )
        .addStringOption(option =>
          option.setName('template_name')
            .setDescription('Name of the template')
            .setRequired(false)
            .setAutocomplete(true)
        )
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleCreate(interaction);
        break;
      case 'builder':
        await handleBuilder(interaction);
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
      case 'edit':
        await handleEdit(interaction);
        break;
      case 'templates':
        await handleTemplates(interaction);
        break;
    }
}

export async function autocomplete(interaction: any) {
  const focusedOption = interaction.options.getFocused(true);
  
  if (focusedOption.name === 'giveaway_id') {
    const giveaways = await giveawayHandler.getGuildGiveaways(interaction.guildId, true);
    const choices = giveaways
      .slice(0, 25)
      .map(g => ({
        name: `${g.title} (${g.id.slice(0, 8)})`,
        value: g.id,
      }));
    
    await interaction.respond(choices);
  } else if (focusedOption.name === 'template_name') {
    const templates = await getGuildTemplates(interaction.guildId);
    const choices = templates
      .slice(0, 25)
      .map(t => ({
        name: t.name,
        value: t.name,
      }));
    
    await interaction.respond(choices);
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const prize = interaction.options.getString('prize', true);
  const durationStr = interaction.options.getString('duration', true);
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const winners = interaction.options.getInteger('winners') || 1;

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
      'Giveaway',
      prize,
      duration,
      winners,
      `React with 🎉 to enter!`
    );

    if (!giveawayId) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to create giveaway.')],
      });
    }

    await interaction.editReply({
      embeds: [createSuccessEmbed('Giveaway Created', `Giveaway for "${prize}" has been created in ${channel}!\n\n**ID:** ${giveawayId}`)],
    });
  } catch (error) {
    console.error('Error creating giveaway:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Invalid duration format. Use formats like: 1h, 30m, 1d, 2h30m')],
    });
  }
}

async function handleBuilder(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  // Start with the giveaway configuration
  const embed = createSuccessEmbed(
    '🎉 Advanced Giveaway Builder',
    'Let\'s create an amazing giveaway! Click the buttons below to configure your giveaway.'
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_basic_info')
        .setLabel('Basic Info')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('giveaway_requirements')
        .setLabel('Requirements')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('giveaway_bonuses')
        .setLabel('Bonus Entries')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('giveaway_embed')
        .setLabel('Customize Embed')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Primary)
    );

  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_preview')
        .setLabel('Preview')
        .setEmoji('👁️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('giveaway_create')
        .setLabel('Create Giveaway')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('giveaway_cancel_builder')
        .setLabel('Cancel')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

  const response = await interaction.reply({
    embeds: [embed],
    components: [row1, row2],
    ephemeral: true,
    fetchReply: true,
  });

  // Initialize giveaway configuration
  const giveawayConfig = {
    title: 'Giveaway',
    prize: '',
    duration: 0,
    winners: 1,
    channel: interaction.channel,
    requirements: {} as GiveawayRequirements,
    bonusEntries: {} as GiveawayBonusEntries,
    embedConfig: {} as EmbedConfig,
  };

  const collector = response.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: 600000, // 10 minutes
  });

  collector.on('collect', async (i: ButtonInteraction) => {
    try {
      switch (i.customId) {
        case 'giveaway_basic_info':
          await showBasicInfoModal(i, giveawayConfig);
          break;
        
        case 'giveaway_requirements':
          await showRequirementsMenu(i, giveawayConfig);
          break;
        
        case 'giveaway_bonuses':
          await showBonusesMenu(i, giveawayConfig);
          break;
        
        case 'giveaway_embed':
          await createEmbedBuilder(i, async (embedConfig) => {
            giveawayConfig.embedConfig = embedConfig;
            await i.followUp({
              content: 'Embed customization saved!',
              ephemeral: true,
            });
          }, giveawayConfig.embedConfig);
          break;
        
        case 'giveaway_preview':
          await showGiveawayPreview(i, giveawayConfig);
          break;
        
        case 'giveaway_create':
          await createGiveawayFromBuilder(i, giveawayConfig);
          collector.stop();
          break;
        
        case 'giveaway_cancel_builder':
          await i.update({
            content: 'Giveaway creation cancelled.',
            embeds: [],
            components: [],
          });
          collector.stop();
          break;
      }

      // Enable create button if basic info is filled
      if (giveawayConfig.prize && giveawayConfig.duration > 0) {
        const components = i.message.components;
        const createButton = components[1].components.find(c => c.customId === 'giveaway_create');
        if (createButton) {
          createButton.setDisabled(false);
        }
      }
    } catch (error) {
      logger.error('Error in giveaway builder', error as Error);
      await i.reply({
        content: 'An error occurred. Please try again.',
        ephemeral: true,
      });
    }
  });
}

async function showBasicInfoModal(interaction: ButtonInteraction, config: any) {
  const modal = new ModalBuilder()
    .setCustomId('giveaway_basic_modal')
    .setTitle('Giveaway Basic Information');

  const prizeInput = new TextInputBuilder()
    .setCustomId('prize')
    .setLabel('Prize')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(500)
    .setRequired(true)
    .setValue(config.prize || '');

  const durationInput = new TextInputBuilder()
    .setCustomId('duration')
    .setLabel('Duration (e.g., 1h, 30m, 1d)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(config.durationStr || '');

  const winnersInput = new TextInputBuilder()
    .setCustomId('winners')
    .setLabel('Number of Winners')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(config.winners.toString());

  const channelInput = new TextInputBuilder()
    .setCustomId('channel')
    .setLabel('Channel ID (leave empty for current channel)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(prizeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(winnersInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput)
  );

  await interaction.showModal(modal);

  try {
    const submission = await interaction.awaitModalSubmit({
      time: 60000,
      filter: (i) => i.customId === 'giveaway_basic_modal' && i.user.id === interaction.user.id,
    });

    config.prize = submission.fields.getTextInputValue('prize');
    config.durationStr = submission.fields.getTextInputValue('duration');
    config.duration = parseDuration(config.durationStr);
    config.winners = parseInt(submission.fields.getTextInputValue('winners')) || 1;

    const channelId = submission.fields.getTextInputValue('channel');
    if (channelId) {
      const channel = interaction.guild?.channels.cache.get(channelId);
      if (channel && channel.type === ChannelType.GuildText) {
        config.channel = channel;
      }
    }

    await submission.reply({
      content: 'Basic information saved!',
      ephemeral: true,
    });

    // Update the original message to enable create button
    const components = interaction.message.components;
    (components[1].components[1] as any).data.disabled = false;
    
    await interaction.editReply({
      components: components as any,
    });
  } catch (error) {
    // Modal timed out
  }
}

async function showRequirementsMenu(interaction: ButtonInteraction, config: any) {
  const embed = createSuccessEmbed(
    '📋 Giveaway Requirements',
    'Select the requirements participants must meet to enter the giveaway.'
  );

  const currentReqs = [];
  if (config.requirements.minLevel) currentReqs.push(`Min Level: ${config.requirements.minLevel}`);
  if (config.requirements.requiredRoles?.length) currentReqs.push(`Required Roles: ${config.requirements.requiredRoles.length}`);
  if (config.requirements.minAccountAge) currentReqs.push(`Min Account Age: ${config.requirements.minAccountAge / 86400000} days`);
  if (config.requirements.minJoinAge) currentReqs.push(`Min Join Age: ${config.requirements.minJoinAge / 86400000} days`);

  if (currentReqs.length > 0) {
    embed.addFields([{ name: 'Current Requirements', value: currentReqs.join('\n'), inline: false }]);
  }

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('req_level')
        .setLabel('Level Requirement')
        .setEmoji('📈')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('req_roles')
        .setLabel('Role Requirements')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('req_account_age')
        .setLabel('Account Age')
        .setEmoji('📅')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('req_join_age')
        .setLabel('Server Join Age')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('req_done')
        .setLabel('Done')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
    );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });

  const collector = interaction.channel?.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('req_'),
    time: 300000,
  });

  collector?.on('collect', async (i: ButtonInteraction) => {
    if (i.customId === 'req_done') {
      await i.update({
        content: 'Requirements saved!',
        embeds: [],
        components: [],
      });
      collector.stop();
      return;
    }

    // Handle requirement modals
    await showRequirementModal(i, config, i.customId);
  });
}

async function showBonusesMenu(interaction: ButtonInteraction, config: any) {
  const embed = createSuccessEmbed(
    '➕ Bonus Entries',
    'Configure bonus entries for special roles or achievements.'
  );

  const currentBonuses = [];
  if (config.bonusEntries.roles) {
    for (const [roleId, bonus] of Object.entries(config.bonusEntries.roles)) {
      currentBonuses.push(`<@&${roleId}>: +${bonus} entries`);
    }
  }
  if (config.bonusEntries.boosts) currentBonuses.push(`Server Boosters: +${config.bonusEntries.boosts} entries`);

  if (currentBonuses.length > 0) {
    embed.addFields([{ name: 'Current Bonuses', value: currentBonuses.join('\n'), inline: false }]);
  }

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('bonus_role')
        .setLabel('Add Role Bonus')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('bonus_boost')
        .setLabel('Booster Bonus')
        .setEmoji('🚀')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('bonus_clear')
        .setLabel('Clear All')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('bonus_done')
        .setLabel('Done')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
    );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });

  const collector = interaction.channel?.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('bonus_'),
    time: 300000,
  });

  collector?.on('collect', async (i: ButtonInteraction) => {
    switch (i.customId) {
      case 'bonus_done':
        await i.update({
          content: 'Bonus entries saved!',
          embeds: [],
          components: [],
        });
        collector.stop();
        break;
      
      case 'bonus_clear':
        config.bonusEntries = {};
        await i.reply({
          content: 'All bonus entries cleared!',
          ephemeral: true,
        });
        break;
      
      default:
        await showBonusModal(i, config, i.customId);
    }
  });
}

async function showGiveawayPreview(interaction: ButtonInteraction, config: any) {
  // Build preview embed
  let embed;
  
  if (config.embedConfig && Object.keys(config.embedConfig).length > 0) {
    // Use custom embed
    embed = new EmbedBuilder();
    
    if (config.embedConfig.title) embed.setTitle(config.embedConfig.title);
    if (config.embedConfig.description) embed.setDescription(config.embedConfig.description);
    if (config.embedConfig.color) embed.setColor(config.embedConfig.color);
    if (config.embedConfig.thumbnail) embed.setThumbnail(config.embedConfig.thumbnail);
    if (config.embedConfig.image) embed.setImage(config.embedConfig.image);
    if (config.embedConfig.footer) embed.setFooter(config.embedConfig.footer);
    if (config.embedConfig.author) embed.setAuthor(config.embedConfig.author);
    if (config.embedConfig.fields) embed.addFields(config.embedConfig.fields);
    if (config.embedConfig.timestamp) embed.setTimestamp();
  } else {
    // Use default embed
    embed = createSuccessEmbed(
      '🎉 GIVEAWAY 🎉',
      `React with 🎉 to enter!\n\n**Prize:** ${config.prize}\n**Winners:** ${config.winners}\n**Duration:** ${config.durationStr}`
    );
  }

  // Add requirement info
  const reqList = [];
  if (config.requirements.minLevel) reqList.push(`• Level ${config.requirements.minLevel}+`);
  if (config.requirements.requiredRoles?.length) reqList.push(`• Must have required roles`);
  if (config.requirements.minAccountAge) reqList.push(`• Account ${config.requirements.minAccountAge / 86400000}+ days old`);
  if (config.requirements.minJoinAge) reqList.push(`• In server ${config.requirements.minJoinAge / 86400000}+ days`);

  if (reqList.length > 0) {
    embed.addFields([{ name: '📋 Requirements', value: reqList.join('\n'), inline: false }]);
  }

  // Add bonus info
  const bonusList = [];
  if (config.bonusEntries.roles) {
    for (const [roleId, bonus] of Object.entries(config.bonusEntries.roles)) {
      bonusList.push(`• <@&${roleId}>: +${bonus} entries`);
    }
  }
  if (config.bonusEntries.boosts) bonusList.push(`• Server Boosters: +${config.bonusEntries.boosts} entries`);

  if (bonusList.length > 0) {
    embed.addFields([{ name: '➕ Bonus Entries', value: bonusList.join('\n'), inline: false }]);
  }

  const button = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_enter_preview')
        .setLabel('🎉 Enter Giveaway')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
    );

  await interaction.reply({
    content: `**Preview** - This giveaway will be posted in ${config.channel}`,
    embeds: [embed],
    components: [button],
    ephemeral: true,
  });
}

async function createGiveawayFromBuilder(interaction: ButtonInteraction, config: any) {
  await interaction.deferUpdate();

  try {
    // Create the giveaway with all configurations
    const giveawayId = await db.transaction(async (client) => {
      const endTime = new Date(Date.now() + config.duration);
      
      const result = await client.query(
        `INSERT INTO giveaways (
          guild_id, channel_id, host_id, title, description, prize, 
          winner_count, end_time, requirements, bonus_entries, embed_config
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
        RETURNING id`,
        [
          interaction.guild!.id,
          config.channel.id,
          interaction.user.id,
          config.embedConfig?.title || 'Giveaway',
          config.embedConfig?.description || `React with 🎉 to enter!`,
          config.prize,
          config.winners,
          endTime,
          JSON.stringify(config.requirements),
          JSON.stringify(config.bonusEntries),
          JSON.stringify(config.embedConfig || {})
        ]
      );

      return result.rows[0].id;
    });

    // Post the giveaway message
    await giveawayHandler.postGiveawayMessage(giveawayId, config.channel.id);

    // Schedule automatic ending
    giveawayHandler.scheduleGiveawayEnd(giveawayId, config.duration);

    await interaction.editReply({
      content: null,
      embeds: [createSuccessEmbed(
        'Giveaway Created!',
        `Your custom giveaway has been posted in ${config.channel}!\n\n**ID:** ${giveawayId}`
      )],
      components: [],
    });

    logger.audit('GIVEAWAY_CREATED', interaction.user.id, interaction.guild!.id, {
      giveawayId,
      prize: config.prize,
      duration: config.duration,
      winners: config.winners,
      requirements: config.requirements,
      bonusEntries: config.bonusEntries,
    });
  } catch (error) {
    logger.error('Error creating giveaway from builder', error as Error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to create giveaway. Please try again.')],
      components: [],
    });
  }
}

// Helper functions for modals
async function showRequirementModal(interaction: ButtonInteraction, config: any, type: string) {
  const modal = new ModalBuilder()
    .setCustomId(`${type}_modal`)
    .setTitle('Set Requirement');

  switch (type) {
    case 'req_level':
      const levelInput = new TextInputBuilder()
        .setCustomId('value')
        .setLabel('Minimum Level Required')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(config.requirements.minLevel?.toString() || '');
      
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(levelInput));
      break;
    
    case 'req_account_age':
      const accountAgeInput = new TextInputBuilder()
        .setCustomId('value')
        .setLabel('Minimum Account Age (in days)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue((config.requirements.minAccountAge / 86400000)?.toString() || '');
      
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(accountAgeInput));
      break;
    
    case 'req_join_age':
      const joinAgeInput = new TextInputBuilder()
        .setCustomId('value')
        .setLabel('Minimum Days in Server')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue((config.requirements.minJoinAge / 86400000)?.toString() || '');
      
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(joinAgeInput));
      break;
  }

  await interaction.showModal(modal);

  try {
    const submission = await interaction.awaitModalSubmit({
      time: 60000,
      filter: (i) => i.customId === `${type}_modal` && i.user.id === interaction.user.id,
    });

    const value = parseInt(submission.fields.getTextInputValue('value'));

    switch (type) {
      case 'req_level':
        config.requirements.minLevel = value;
        break;
      case 'req_account_age':
        config.requirements.minAccountAge = value * 86400000;
        break;
      case 'req_join_age':
        config.requirements.minJoinAge = value * 86400000;
        break;
    }

    await submission.reply({
      content: 'Requirement updated!',
      ephemeral: true,
    });
  } catch (error) {
    // Modal timed out
  }
}

async function showBonusModal(interaction: ButtonInteraction, config: any, type: string) {
  if (type === 'bonus_boost') {
    const modal = new ModalBuilder()
      .setCustomId('bonus_boost_modal')
      .setTitle('Server Booster Bonus');

    const bonusInput = new TextInputBuilder()
      .setCustomId('value')
      .setLabel('Bonus entries for server boosters')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(config.bonusEntries.boosts?.toString() || '');

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(bonusInput));

    await interaction.showModal(modal);

    try {
      const submission = await interaction.awaitModalSubmit({
        time: 60000,
        filter: (i) => i.customId === 'bonus_boost_modal' && i.user.id === interaction.user.id,
      });

      config.bonusEntries.boosts = parseInt(submission.fields.getTextInputValue('value'));

      await submission.reply({
        content: 'Booster bonus updated!',
        ephemeral: true,
      });
    } catch (error) {
      // Modal timed out
    }
  }
}

// Other handler functions remain similar...
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

  await db.query(
    'UPDATE giveaways SET cancelled = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [giveawayId]
  );

  await interaction.editReply({
    embeds: [createSuccessEmbed('Giveaway Cancelled', `Giveaway "${giveaway.title}" has been cancelled.`)],
  });
}

async function handleEdit(interaction: ChatInputCommandInteraction) {
  // Implementation for editing active giveaways
  await interaction.reply({
    content: 'Giveaway editing is not yet implemented.',
    ephemeral: true,
  });
}

async function handleTemplates(interaction: ChatInputCommandInteraction) {
  const action = interaction.options.getString('action', true);
  const templateName = interaction.options.getString('template_name');

  switch (action) {
    case 'list':
      await listTemplates(interaction);
      break;
    case 'create':
      await createTemplate(interaction);
      break;
    case 'delete':
      if (!templateName) {
        return await interaction.reply({
          embeds: [createErrorEmbed('Error', 'Please provide a template name to delete.')],
          ephemeral: true,
        });
      }
      await deleteTemplate(interaction, templateName);
      break;
    case 'use':
      if (!templateName) {
        return await interaction.reply({
          embeds: [createErrorEmbed('Error', 'Please provide a template name to use.')],
          ephemeral: true,
        });
      }
      await useTemplate(interaction, templateName);
      break;
  }
}

async function listTemplates(interaction: ChatInputCommandInteraction) {
  const templates = await getGuildTemplates(interaction.guildId!);

  if (templates.length === 0) {
    return await interaction.reply({
      embeds: [createErrorEmbed('No Templates', 'No giveaway templates found for this server.')],
      ephemeral: true,
    });
  }

  const embed = createSuccessEmbed('Giveaway Templates', `Found ${templates.length} template(s)`);

  templates.forEach(template => {
    embed.addFields([{
      name: template.name,
      value: `${template.description || 'No description'}\n**Created by:** <@${template.creator_id}>\n**Used:** ${template.usage_count} times`,
      inline: true
    }]);
  });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function createTemplate(interaction: ChatInputCommandInteraction) {
  // Start template creation process similar to builder
  await interaction.reply({
    content: 'Template creation will guide you through creating a reusable giveaway template.',
    ephemeral: true,
  });
}

async function deleteTemplate(interaction: ChatInputCommandInteraction, templateName: string) {
  try {
    await db.query(
      'DELETE FROM giveaway_templates WHERE guild_id = $1 AND name = $2',
      [interaction.guildId, templateName]
    );

    await interaction.reply({
      embeds: [createSuccessEmbed('Template Deleted', `Template "${templateName}" has been deleted.`)],
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to delete template.')],
      ephemeral: true,
    });
  }
}

async function useTemplate(interaction: ChatInputCommandInteraction, templateName: string) {
  const template = await getTemplate(interaction.guildId!, templateName);

  if (!template) {
    return await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Template not found.')],
      ephemeral: true,
    });
  }

  // Update usage count
  await db.query(
    'UPDATE giveaway_templates SET usage_count = usage_count + 1 WHERE id = $1',
    [template.id]
  );

  // Start builder with template config
  await handleBuilder(interaction);
}

async function getGuildTemplates(guildId: string) {
  const result = await db.query(
    'SELECT * FROM giveaway_templates WHERE guild_id = $1 ORDER BY name',
    [guildId]
  );
  return result.rows;
}

async function getTemplate(guildId: string, name: string) {
  const result = await db.query(
    'SELECT * FROM giveaway_templates WHERE guild_id = $1 AND name = $2',
    [guildId, name]
  );
  return result.rows[0];
}