import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, TextChannel, ChannelType, Role, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, hasPermission } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Interactive server setup wizard')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  const member = interaction.member as GuildMember;

  if (!hasPermission(member, PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You need Administrator permission to use this command.')],
      ephemeral: true,
    });
  }

  try {
    // Get current settings
    const settings = await db.query(
      'SELECT * FROM guild_settings WHERE guild_id = $1',
      [interaction.guild.id]
    );

    const currentSettings = settings.rows[0] || {};

    const embed = createSuccessEmbed(
      'Server Setup Wizard',
      `${emojis.server} Welcome to the interactive server setup! Configure your server's features step by step.`
    );

    embed.addFields(
      { name: 'Current Status', value: 'Click the buttons below to configure different aspects of your server.', inline: false },
      { name: 'Features to Configure', value: [
        '🔧 **Basic Settings** - Prefix, language, timezone',
        '📝 **Logging** - Moderation, join/leave logs',
        '👋 **Welcome System** - Welcome messages and autoroles',
        '🛡️ **Moderation** - AutoMod settings and features',
        '💰 **Economy** - Economic system configuration',
        '🎫 **Tickets** - Support ticket system',
        '⭐ **XP System** - Leveling and rewards'
      ].join('\n'), inline: false }
    );

    const row1 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_basic')
          .setLabel('Basic Settings')
          .setEmoji('🔧')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('setup_logging')
          .setLabel('Logging')
          .setEmoji('📝')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('setup_welcome')
          .setLabel('Welcome System')
          .setEmoji('👋')
          .setStyle(ButtonStyle.Primary)
      );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_moderation')
          .setLabel('Moderation')
          .setEmoji('🛡️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('setup_economy')
          .setLabel('Economy')
          .setEmoji('💰')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('setup_tickets')
          .setLabel('Tickets')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary)
      );

    const row3 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_xp')
          .setLabel('XP System')
          .setEmoji('⭐')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('setup_finish')
          .setLabel('Finish Setup')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('setup_cancel')
          .setLabel('Cancel')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
      );

    const response = await interaction.reply({
      embeds: [embed],
      components: [row1, row2, row3],
      ephemeral: true
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({
          embeds: [createErrorEmbed('Error', 'Only the command user can use these buttons.')],
          ephemeral: true
        });
      }

      await buttonInteraction.deferUpdate();

      switch (buttonInteraction.customId) {
        case 'setup_basic':
          await handleBasicSetup(buttonInteraction, currentSettings);
          break;
        case 'setup_logging':
          await handleLoggingSetup(buttonInteraction, currentSettings);
          break;
        case 'setup_welcome':
          await handleWelcomeSetup(buttonInteraction, currentSettings);
          break;
        case 'setup_moderation':
          await handleModerationSetup(buttonInteraction, currentSettings);
          break;
        case 'setup_economy':
          await handleEconomySetup(buttonInteraction, currentSettings);
          break;
        case 'setup_tickets':
          await handleTicketsSetup(buttonInteraction, currentSettings);
          break;
        case 'setup_xp':
          await handleXPSetup(buttonInteraction, currentSettings);
          break;
        case 'setup_finish':
          await handleFinishSetup(buttonInteraction);
          collector.stop();
          break;
        case 'setup_cancel':
          const cancelEmbed = createErrorEmbed('Setup Cancelled', 'Server setup has been cancelled.');
          await buttonInteraction.editReply({ embeds: [cancelEmbed], components: [] });
          collector.stop();
          break;
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        const timeoutEmbed = createErrorEmbed('Setup Timeout', 'Setup wizard has timed out. Please run the command again.');
        try {
          await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
        } catch (error) {
          // Ignore errors if interaction was already handled
        }
      }
    });

  } catch (error) {
    console.error('Error in setup command:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to start setup wizard. Please try again.')],
      ephemeral: true,
    });
  }
}

async function handleBasicSetup(interaction: any, currentSettings: any) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('basic_setting')
    .setPlaceholder('Select a basic setting to configure')
    .addOptions([
      {
        label: 'Command Prefix',
        description: `Current: ${currentSettings.prefix || '!'}`,
        value: 'prefix',
        emoji: '🔧'
      },
      {
        label: 'Language',
        description: `Current: ${currentSettings.language || 'en'}`,
        value: 'language',
        emoji: '🌐'
      },
      {
        label: 'Timezone',
        description: `Current: ${currentSettings.timezone || 'UTC'}`,
        value: 'timezone',
        emoji: '🕐'
      }
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  const backButton = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_main')
        .setLabel('Back to Main Menu')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
    );

  const embed = createSuccessEmbed(
    'Basic Settings Configuration',
    'Select which basic setting you want to configure:'
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row, backButton]
  });
}

async function handleLoggingSetup(interaction: any, currentSettings: any) {
  const channels = interaction.guild.channels.cache
    .filter((channel: any) => channel.type === ChannelType.GuildText)
    .map((channel: any) => ({
      label: `#${channel.name}`,
      description: `ID: ${channel.id}`,
      value: channel.id
    }))
    .slice(0, 25); // Discord limit

  if (channels.length === 0) {
    const embed = createErrorEmbed('No Channels', 'No text channels found in this server.');
    return interaction.editReply({ embeds: [embed], components: [] });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('logging_channel')
    .setPlaceholder('Select channels for logging')
    .addOptions(channels);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  const backButton = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_main')
        .setLabel('Back to Main Menu')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
    );

  const embed = createSuccessEmbed(
    'Logging Configuration',
    `${emojis.log} Configure logging channels for your server:\n\n` +
    `**Current Settings:**\n` +
    `• Moderation Log: ${currentSettings.log_channel ? `<#${currentSettings.log_channel}>` : 'Not set'}\n` +
    `• Join Log: ${currentSettings.join_log_channel_id ? `<#${currentSettings.join_log_channel_id}>` : 'Not set'}\n` +
    `• Leave Log: ${currentSettings.leave_log_channel_id ? `<#${currentSettings.leave_log_channel_id}>` : 'Not set'}`
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row, backButton]
  });
}

async function handleWelcomeSetup(interaction: any, currentSettings: any) {
  const embed = createSuccessEmbed(
    'Welcome System Configuration',
    `${emojis.wave} Configure your server's welcome system:\n\n` +
    `**Current Settings:**\n` +
    `• Welcome Enabled: ${currentSettings.welcome_enabled ? 'Yes' : 'No'}\n` +
    `• Welcome Channel: ${currentSettings.welcome_channel_id ? `<#${currentSettings.welcome_channel_id}>` : 'Not set'}\n` +
    `• Auto Role: ${currentSettings.autorole_id ? `<@&${currentSettings.autorole_id}>` : 'Not set'}\n` +
    `• Welcome Message: ${currentSettings.welcome_message ? 'Custom message set' : 'Default message'}`
  );

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`welcome_toggle_${!currentSettings.welcome_enabled}`)
        .setLabel(currentSettings.welcome_enabled ? 'Disable Welcome' : 'Enable Welcome')
        .setEmoji(currentSettings.welcome_enabled ? '❌' : '✅')
        .setStyle(currentSettings.welcome_enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('welcome_channel')
        .setLabel('Set Channel')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('welcome_autorole')
        .setLabel('Set Auto Role')
        .setEmoji('🎭')
        .setStyle(ButtonStyle.Primary)
    );

  const backButton = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_main')
        .setLabel('Back to Main Menu')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.editReply({
    embeds: [embed],
    components: [row, backButton]
  });
}

async function handleModerationSetup(interaction: any, currentSettings: any) {
  const embed = createSuccessEmbed(
    'Moderation Configuration',
    `${emojis.shield} Configure your server's moderation features:\n\n` +
    `**Available Features:**\n` +
    `• AutoMod System\n` +
    `• Warning System\n` +
    `• Temporary Punishments\n` +
    `• Raid Protection`
  );

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('mod_automod')
        .setLabel('Configure AutoMod')
        .setEmoji('🤖')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('mod_warnings')
        .setLabel('Warning System')
        .setEmoji('⚠️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('mod_punishments')
        .setLabel('Punishments')
        .setEmoji('🔨')
        .setStyle(ButtonStyle.Primary)
    );

  const backButton = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_main')
        .setLabel('Back to Main Menu')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.editReply({
    embeds: [embed],
    components: [row, backButton]
  });
}

async function handleEconomySetup(interaction: any, currentSettings: any) {
  const embed = createSuccessEmbed(
    'Economy System Configuration',
    `${emojis.coin} Configure your server's economy system:\n\n` +
    `**Features:**\n` +
    `• Daily Rewards\n` +
    `• Work Commands\n` +
    `• Shop System\n` +
    `• Gambling Games`
  );

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('economy_enable')
        .setLabel('Enable Economy')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('economy_shop')
        .setLabel('Configure Shop')
        .setEmoji('🛒')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('economy_rewards')
        .setLabel('Set Rewards')
        .setEmoji('🎁')
        .setStyle(ButtonStyle.Primary)
    );

  const backButton = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_main')
        .setLabel('Back to Main Menu')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.editReply({
    embeds: [embed],
    components: [row, backButton]
  });
}

async function handleTicketsSetup(interaction: any, currentSettings: any) {
  const embed = createSuccessEmbed(
    'Ticket System Configuration',
    `${emojis.ticket} Configure your server's support ticket system:\n\n` +
    `**Features:**\n` +
    `• Automatic ticket creation\n` +
    `• Category organization\n` +
    `• Staff notifications\n` +
    `• Ticket transcripts`
  );

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('tickets_enable')
        .setLabel('Enable Tickets')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('tickets_category')
        .setLabel('Set Category')
        .setEmoji('📁')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tickets_staff')
        .setLabel('Set Staff Role')
        .setEmoji('👨‍💼')
        .setStyle(ButtonStyle.Primary)
    );

  const backButton = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_main')
        .setLabel('Back to Main Menu')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.editReply({
    embeds: [embed],
    components: [row, backButton]
  });
}

async function handleXPSetup(interaction: any, currentSettings: any) {
  const embed = createSuccessEmbed(
    'XP System Configuration',
    `${emojis.xp} Configure your server's XP and leveling system:\n\n` +
    `**Features:**\n` +
    `• Message XP rewards\n` +
    `• Voice channel XP\n` +
    `• Level up notifications\n` +
    `• Role rewards`
  );

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('xp_enable')
        .setLabel('Enable XP System')
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('xp_rewards')
        .setLabel('Configure Rewards')
        .setEmoji('🏆')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('xp_settings')
        .setLabel('XP Settings')
        .setEmoji('⚙️')
        .setStyle(ButtonStyle.Primary)
    );

  const backButton = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_main')
        .setLabel('Back to Main Menu')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.editReply({
    embeds: [embed],
    components: [row, backButton]
  });
}

async function handleFinishSetup(interaction: any) {
  const embed = createSuccessEmbed(
    'Setup Complete!',
    `${emojis.success} Your server setup is now complete!\n\n` +
    `**What's Next?**\n` +
    `• Test your configured features\n` +
    `• Adjust settings as needed using specific commands\n` +
    `• Check out the help command for more features\n\n` +
    `**Helpful Commands:**\n` +
    `• \`/settings\` - View and modify settings\n` +
    `• \`/help\` - Get help with commands\n` +
    `• \`/stats\` - View server statistics`
  );

  embed.setFooter({ text: 'Thank you for using our bot!' });

  await interaction.editReply({
    embeds: [embed],
    components: []
  });
}