import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, ChannelType, Role } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, hasPermission } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Manage server settings')
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View current server settings')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('prefix')
      .setDescription('Set the command prefix')
      .addStringOption(option =>
        option.setName('prefix')
          .setDescription('New command prefix')
          .setRequired(true)
          .setMaxLength(5)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('language')
      .setDescription('Set the server language')
      .addStringOption(option =>
        option.setName('language')
          .setDescription('Server language')
          .setRequired(true)
          .addChoices(
            { name: 'English', value: 'en' },
            { name: 'Spanish', value: 'es' },
            { name: 'French', value: 'fr' },
            { name: 'German', value: 'de' },
            { name: 'Portuguese', value: 'pt' },
            { name: 'Russian', value: 'ru' },
            { name: 'Japanese', value: 'ja' },
            { name: 'Korean', value: 'ko' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('logs')
      .setDescription('Configure logging channels')
      .addChannelOption(option =>
        option.setName('moderation')
          .setDescription('Channel for moderation logs')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
      .addChannelOption(option =>
        option.setName('join')
          .setDescription('Channel for join logs')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
      .addChannelOption(option =>
        option.setName('leave')
          .setDescription('Channel for leave logs')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('welcome')
      .setDescription('Configure welcome system')
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Enable or disable welcome messages')
          .setRequired(false)
      )
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Welcome message channel')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('message')
          .setDescription('Welcome message (use {user} for mention, {guild} for server name)')
          .setRequired(false)
          .setMaxLength(1000)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('autorole')
      .setDescription('Configure automatic role assignment')
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Enable or disable autorole')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Role to automatically assign to new members')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('features')
      .setDescription('Enable or disable bot features')
      .addStringOption(option =>
        option.setName('feature')
          .setDescription('Feature to toggle')
          .setRequired(true)
          .addChoices(
            { name: 'Economy System', value: 'economy' },
            { name: 'XP System', value: 'xp' },
            { name: 'Ticket System', value: 'tickets' },
            { name: 'Auto Moderation', value: 'automod' },
            { name: 'Welcome Messages', value: 'welcome' },
            { name: 'Leveling Notifications', value: 'level_notifications' },
            { name: 'Join/Leave Logs', value: 'join_leave_logs' }
          )
      )
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Enable or disable the feature')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('limits')
      .setDescription('Configure server limits')
      .addIntegerOption(option =>
        option.setName('max_warnings')
          .setDescription('Maximum warnings before automatic punishment')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(20)
      )
      .addIntegerOption(option =>
        option.setName('max_tickets')
          .setDescription('Maximum tickets per user')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(10)
      )
      .addIntegerOption(option =>
        option.setName('slowmode_default')
          .setDescription('Default slowmode duration in seconds')
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(21600)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reset')
      .setDescription('Reset all settings to defaults')
      .addBooleanOption(option =>
        option.setName('confirm')
          .setDescription('Confirm that you want to reset all settings')
          .setRequired(true)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  const member = interaction.member as GuildMember;

  if (!hasPermission(member, PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You need the Manage Server permission to use this command.')],
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    // Ensure guild settings exist
    await db.query(
      `INSERT INTO guild_settings (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`,
      [interaction.guild.id]
    );

    switch (subcommand) {
      case 'view':
        await handleViewSettings(interaction);
        break;
      case 'prefix':
        await handlePrefixSetting(interaction);
        break;
      case 'language':
        await handleLanguageSetting(interaction);
        break;
      case 'logs':
        await handleLogsSetting(interaction);
        break;
      case 'welcome':
        await handleWelcomeSetting(interaction);
        break;
      case 'autorole':
        await handleAutoroleSetting(interaction);
        break;
      case 'features':
        await handleFeaturesSetting(interaction);
        break;
      case 'limits':
        await handleLimitsSetting(interaction);
        break;
      case 'reset':
        await handleResetSettings(interaction);
        break;
    }

  } catch (error) {
    console.error('Error managing settings:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to manage settings. Please try again.')],
      ephemeral: true,
    });
  }
}

async function handleViewSettings(interaction: any) {
  const result = await db.query(
    'SELECT * FROM guild_settings WHERE guild_id = $1',
    [interaction.guild.id]
  );

  const settings = result.rows[0] || {};

  const embed = createSuccessEmbed(
    'Server Settings',
    `${emojis.settings} Current configuration for **${interaction.guild.name}**`
  );

  // Basic Settings
  embed.addFields({
    name: '🔧 Basic Settings',
    value: [
      `**Prefix:** \`${settings.prefix || '!'}\``,
      `**Language:** ${settings.language || 'en'}`,
      `**Timezone:** ${settings.timezone || 'UTC'}`
    ].join('\n'),
    inline: true
  });

  // Logging Settings
  embed.addFields({
    name: '📝 Logging',
    value: [
      `**Moderation:** ${settings.log_channel ? `<#${settings.log_channel}>` : 'Not set'}`,
      `**Join Logs:** ${settings.join_log_channel_id ? `<#${settings.join_log_channel_id}>` : 'Not set'}`,
      `**Leave Logs:** ${settings.leave_log_channel_id ? `<#${settings.leave_log_channel_id}>` : 'Not set'}`
    ].join('\n'),
    inline: true
  });

  // Welcome System
  embed.addFields({
    name: '👋 Welcome System',
    value: [
      `**Enabled:** ${settings.welcome_enabled ? 'Yes' : 'No'}`,
      `**Channel:** ${settings.welcome_channel_id ? `<#${settings.welcome_channel_id}>` : 'Not set'}`,
      `**Auto Role:** ${settings.autorole_id ? `<@&${settings.autorole_id}>` : 'Not set'}`
    ].join('\n'),
    inline: true
  });

  // Feature Status
  const features = [
    `**Economy:** ${settings.economy_enabled !== false ? 'Enabled' : 'Disabled'}`,
    `**XP System:** ${settings.xp_enabled !== false ? 'Enabled' : 'Disabled'}`,
    `**Tickets:** ${settings.tickets_enabled !== false ? 'Enabled' : 'Disabled'}`,
    `**AutoMod:** ${settings.automod_enabled || false ? 'Enabled' : 'Disabled'}`
  ].join('\n');

  embed.addFields({
    name: '⚙️ Features',
    value: features,
    inline: true
  });

  // Limits
  embed.addFields({
    name: '📊 Limits',
    value: [
      `**Max Warnings:** ${settings.max_warnings || 3}`,
      `**Max Tickets:** ${settings.max_tickets_per_user || 5}`,
      `**Default Slowmode:** ${settings.default_slowmode || 0}s`
    ].join('\n'),
    inline: true
  });

  embed.addFields({
    name: '💡 Tip',
    value: 'Use `/settings <category>` to modify specific settings.',
    inline: false
  });

  await interaction.reply({ embeds: [embed] });
}

async function handlePrefixSetting(interaction: any) {
  const newPrefix = interaction.options.getString('prefix', true);

  // Validate prefix
  if (newPrefix.length > 5) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'Prefix cannot be longer than 5 characters.')],
      ephemeral: true,
    });
  }

  if (/\s/.test(newPrefix)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'Prefix cannot contain spaces.')],
      ephemeral: true,
    });
  }

  await db.query(
    'UPDATE guild_settings SET prefix = $1 WHERE guild_id = $2',
    [newPrefix, interaction.guild.id]
  );

  const embed = createSuccessEmbed(
    'Prefix Updated',
    `${emojis.success} Command prefix has been set to \`${newPrefix}\``
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleLanguageSetting(interaction: any) {
  const newLanguage = interaction.options.getString('language', true);

  await db.query(
    'UPDATE guild_settings SET language = $1 WHERE guild_id = $2',
    [newLanguage, interaction.guild.id]
  );

  const languageNames: { [key: string]: string } = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    ru: 'Russian',
    ja: 'Japanese',
    ko: 'Korean'
  };

  const embed = createSuccessEmbed(
    'Language Updated',
    `${emojis.success} Server language has been set to **${languageNames[newLanguage]}**`
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleLogsSetting(interaction: any) {
  const moderationChannel = interaction.options.getChannel('moderation');
  const joinChannel = interaction.options.getChannel('join');
  const leaveChannel = interaction.options.getChannel('leave');

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (moderationChannel) {
    updates.push(`log_channel = $${paramIndex++}`);
    values.push(moderationChannel.id);
  }

  if (joinChannel) {
    updates.push(`join_log_channel_id = $${paramIndex++}`);
    values.push(joinChannel.id);
  }

  if (leaveChannel) {
    updates.push(`leave_log_channel_id = $${paramIndex++}`);
    values.push(leaveChannel.id);
  }

  if (updates.length === 0) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'Please specify at least one logging channel.')],
      ephemeral: true,
    });
  }

  values.push(interaction.guild.id);
  await db.query(
    `UPDATE guild_settings SET ${updates.join(', ')} WHERE guild_id = $${paramIndex}`,
    values
  );

  const embed = createSuccessEmbed(
    'Logging Settings Updated',
    `${emojis.log} Logging channels have been configured successfully.`
  );

  const fields = [];
  if (moderationChannel) fields.push(`**Moderation:** ${moderationChannel}`);
  if (joinChannel) fields.push(`**Join Logs:** ${joinChannel}`);
  if (leaveChannel) fields.push(`**Leave Logs:** ${leaveChannel}`);

  embed.addFields({ name: 'Updated Channels', value: fields.join('\n'), inline: false });

  await interaction.reply({ embeds: [embed] });
}

async function handleWelcomeSetting(interaction: any) {
  const enabled = interaction.options.getBoolean('enabled');
  const channel = interaction.options.getChannel('channel');
  const message = interaction.options.getString('message');

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (enabled !== null) {
    updates.push(`welcome_enabled = $${paramIndex++}`);
    values.push(enabled);
  }

  if (channel) {
    updates.push(`welcome_channel_id = $${paramIndex++}`);
    values.push(channel.id);
  }

  if (message) {
    updates.push(`welcome_message = $${paramIndex++}`);
    values.push(message);
  }

  if (updates.length === 0) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'Please specify at least one welcome setting.')],
      ephemeral: true,
    });
  }

  values.push(interaction.guild.id);
  await db.query(
    `UPDATE guild_settings SET ${updates.join(', ')} WHERE guild_id = $${paramIndex}`,
    values
  );

  const embed = createSuccessEmbed(
    'Welcome Settings Updated',
    `${emojis.wave} Welcome system has been configured successfully.`
  );

  const fields = [];
  if (enabled !== null) fields.push(`**Status:** ${enabled ? 'Enabled' : 'Disabled'}`);
  if (channel) fields.push(`**Channel:** ${channel}`);
  if (message) fields.push(`**Message:** ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

  if (fields.length > 0) {
    embed.addFields({ name: 'Updated Settings', value: fields.join('\n'), inline: false });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleAutoroleSetting(interaction: any) {
  const enabled = interaction.options.getBoolean('enabled');
  const role = interaction.options.getRole('role');

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (enabled !== null) {
    updates.push(`autorole_enabled = $${paramIndex++}`);
    values.push(enabled);
  }

  if (role) {
    updates.push(`autorole_id = $${paramIndex++}`);
    values.push(role.id);
  }

  if (updates.length === 0) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'Please specify autorole settings.')],
      ephemeral: true,
    });
  }

  values.push(interaction.guild.id);
  await db.query(
    `UPDATE guild_settings SET ${updates.join(', ')} WHERE guild_id = $${paramIndex}`,
    values
  );

  const embed = createSuccessEmbed(
    'Auto Role Settings Updated',
    `${emojis.role} Auto role system has been configured successfully.`
  );

  const fields = [];
  if (enabled !== null) fields.push(`**Status:** ${enabled ? 'Enabled' : 'Disabled'}`);
  if (role) fields.push(`**Role:** ${role}`);

  if (fields.length > 0) {
    embed.addFields({ name: 'Updated Settings', value: fields.join('\n'), inline: false });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleFeaturesSetting(interaction: any) {
  const feature = interaction.options.getString('feature', true);
  const enabled = interaction.options.getBoolean('enabled', true);

  const featureColumns: { [key: string]: string } = {
    economy: 'economy_enabled',
    xp: 'xp_enabled',
    tickets: 'tickets_enabled',
    automod: 'automod_enabled',
    welcome: 'welcome_enabled',
    level_notifications: 'level_notifications_enabled',
    join_leave_logs: 'join_leave_logs_enabled'
  };

  const column = featureColumns[feature];
  if (!column) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'Invalid feature specified.')],
      ephemeral: true,
    });
  }

  await db.query(
    `UPDATE guild_settings SET ${column} = $1 WHERE guild_id = $2`,
    [enabled, interaction.guild.id]
  );

  const featureNames: { [key: string]: string } = {
    economy: 'Economy System',
    xp: 'XP System',
    tickets: 'Ticket System',
    automod: 'Auto Moderation',
    welcome: 'Welcome Messages',
    level_notifications: 'Leveling Notifications',
    join_leave_logs: 'Join/Leave Logs'
  };

  const embed = createSuccessEmbed(
    'Feature Updated',
    `${emojis.success} **${featureNames[feature]}** has been **${enabled ? 'enabled' : 'disabled'}**.`
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleLimitsSetting(interaction: any) {
  const maxWarnings = interaction.options.getInteger('max_warnings');
  const maxTickets = interaction.options.getInteger('max_tickets');
  const slowmodeDefault = interaction.options.getInteger('slowmode_default');

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (maxWarnings !== null) {
    updates.push(`max_warnings = $${paramIndex++}`);
    values.push(maxWarnings);
  }

  if (maxTickets !== null) {
    updates.push(`max_tickets_per_user = $${paramIndex++}`);
    values.push(maxTickets);
  }

  if (slowmodeDefault !== null) {
    updates.push(`default_slowmode = $${paramIndex++}`);
    values.push(slowmodeDefault);
  }

  if (updates.length === 0) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'Please specify at least one limit to update.')],
      ephemeral: true,
    });
  }

  values.push(interaction.guild.id);
  await db.query(
    `UPDATE guild_settings SET ${updates.join(', ')} WHERE guild_id = $${paramIndex}`,
    values
  );

  const embed = createSuccessEmbed(
    'Limits Updated',
    `${emojis.success} Server limits have been updated successfully.`
  );

  const fields = [];
  if (maxWarnings !== null) fields.push(`**Max Warnings:** ${maxWarnings}`);
  if (maxTickets !== null) fields.push(`**Max Tickets:** ${maxTickets}`);
  if (slowmodeDefault !== null) fields.push(`**Default Slowmode:** ${slowmodeDefault}s`);

  embed.addFields({ name: 'Updated Limits', value: fields.join('\n'), inline: false });

  await interaction.reply({ embeds: [embed] });
}

async function handleResetSettings(interaction: any) {
  const confirm = interaction.options.getBoolean('confirm', true);

  if (!confirm) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You must confirm to reset all settings.')],
      ephemeral: true,
    });
  }

  await db.query(
    'DELETE FROM guild_settings WHERE guild_id = $1',
    [interaction.guild.id]
  );

  // Recreate with defaults
  await db.query(
    'INSERT INTO guild_settings (guild_id) VALUES ($1)',
    [interaction.guild.id]
  );

  const embed = createSuccessEmbed(
    'Settings Reset',
    `${emojis.reset} All server settings have been reset to defaults.`
  );

  embed.addFields({
    name: 'What was reset?',
    value: [
      '• Command prefix reset to `!`',
      '• Language reset to English',
      '• All logging channels cleared',
      '• Welcome system disabled',
      '• Auto role disabled',
      '• All features enabled by default',
      '• Limits reset to defaults'
    ].join('\n'),
    inline: false
  });

  await interaction.reply({ embeds: [embed] });
}