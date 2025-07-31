import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  PermissionFlagsBits,
  ChannelType,
  Role
} from 'discord.js';
import { db } from '../../database/connection';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/helpers';
import { colors } from '../../utils/config';
import { ticketHandler } from '../../handlers/tickets';

export const command = {
  data: new SlashCommandBuilder()
    .setName('ticket-settings')
    .setDescription('Configure ticket system settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current ticket system settings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable or disable the ticket system')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Enable or disable the ticket system')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('limits')
        .setDescription('Configure ticket limits')
        .addIntegerOption(option =>
          option
            .setName('max_tickets_per_user')
            .setDescription('Maximum tickets per user (1-20)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addIntegerOption(option =>
          option
            .setName('auto_close_hours')
            .setDescription('Hours before auto-closing inactive tickets (24-720)')
            .setRequired(false)
            .setMinValue(24)
            .setMaxValue(720)
        )
        .addIntegerOption(option =>
          option
            .setName('warning_hours')
            .setDescription('Hours before warning about auto-close (12-168)')
            .setRequired(false)
            .setMinValue(12)
            .setMaxValue(168)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('roles')
        .setDescription('Configure ticket roles')
        .addRoleOption(option =>
          option
            .setName('support_role')
            .setDescription('Add a support role')
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('admin_role')
            .setDescription('Add an admin role')
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('ping_role')
            .setDescription('Add a ping role')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('action')
            .setDescription('Action to perform')
            .setRequired(false)
            .addChoices(
              { name: 'Add Role', value: 'add' },
              { name: 'Remove Role', value: 'remove' },
              { name: 'Clear All', value: 'clear' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('channels')
        .setDescription('Configure ticket channels')
        .addChannelOption(option =>
          option
            .setName('transcript_channel')
            .setDescription('Channel for ticket transcripts')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
          option
            .setName('log_channel')
            .setDescription('Channel for ticket activity logs')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addBooleanOption(option =>
          option
            .setName('auto_transcript')
            .setDescription('Automatically generate transcripts when tickets close')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('messages')
        .setDescription('Configure ticket messages')
        .addStringOption(option =>
          option
            .setName('welcome_message')
            .setDescription('Message shown when a ticket is created')
            .setRequired(false)
            .setMaxLength(1000)
        )
        .addStringOption(option =>
          option
            .setName('close_message')
            .setDescription('Message shown when a ticket is closed')
            .setRequired(false)
            .setMaxLength(1000)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('rate-limiting')
        .setDescription('Configure rate limiting')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Enable rate limiting')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of tickets allowed per time window (1-10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
        .addIntegerOption(option =>
          option
            .setName('window_minutes')
            .setDescription('Time window in minutes (5-1440)')
            .setRequired(false)
            .setMinValue(5)
            .setMaxValue(1440)
        )
    ),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'view':
        await handleViewSettings(interaction);
        break;
      case 'enable':
        await handleEnableToggle(interaction);
        break;
      case 'limits':
        await handleLimitsConfig(interaction);
        break;
      case 'roles':
        await handleRolesConfig(interaction);
        break;
      case 'channels':
        await handleChannelsConfig(interaction);
        break;
      case 'messages':
        await handleMessagesConfig(interaction);
        break;
      case 'rate-limiting':
        await handleRateLimitConfig(interaction);
        break;
    }
  },
};

async function handleViewSettings(interaction: CommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply();

  try {
    const settings = await ticketHandler.getTicketSettings(interaction.guild.id);
    
    const embed = createEmbed({
      title: '⚙️ Ticket System Settings',
      description: `Configuration for **${interaction.guild.name}**`,
      color: colors.primary
    });

    // System Status
    embed.addFields({
      name: '🔧 System Status',
      value: `**Enabled:** ${settings.enabled ? '✅ Yes' : '❌ No'}\n` +
             `**Max Tickets per User:** ${settings.max_tickets_per_user}\n` +
             `**Auto-close:** ${settings.auto_close_enabled ? `✅ ${settings.auto_close_time_hours}h` : '❌ Disabled'}\n` +
             `**Auto-close Warning:** ${settings.auto_close_warning_hours}h before`,
      inline: false
    });

    // Roles Configuration
    if (settings.support_roles.length > 0 || settings.admin_roles.length > 0 || settings.ping_roles.length > 0) {
      let rolesText = '';
      if (settings.support_roles.length > 0) {
        rolesText += `**Support:** ${settings.support_roles.map(id => `<@&${id}>`).join(', ')}\n`;
      }
      if (settings.admin_roles.length > 0) {
        rolesText += `**Admin:** ${settings.admin_roles.map(id => `<@&${id}>`).join(', ')}\n`;
      }
      if (settings.ping_roles.length > 0) {
        rolesText += `**Ping:** ${settings.ping_roles.map(id => `<@&${id}>`).join(', ')}`;
      }

      embed.addFields({
        name: '👥 Roles',
        value: rolesText || 'No roles configured',
        inline: true
      });
    }

    // Channels Configuration
    let channelsText = '';
    if (settings.transcript_channel_id) {
      channelsText += `**Transcripts:** <#${settings.transcript_channel_id}>\n`;
    }
    if (settings.log_channel_id) {
      channelsText += `**Logs:** <#${settings.log_channel_id}>\n`;
    }
    channelsText += `**Auto-transcript:** ${settings.auto_transcript ? '✅' : '❌'}`;

    embed.addFields({
      name: '📋 Channels',
      value: channelsText || 'No channels configured',
      inline: true
    });

    // Rate Limiting
    embed.addFields({
      name: '🚦 Rate Limiting',
      value: settings.rate_limit_enabled 
        ? `**Enabled:** ✅\n**Limit:** ${settings.rate_limit_count} per ${settings.rate_limit_window_minutes}m`
        : '**Enabled:** ❌',
      inline: true
    });

    // Messages (truncated for display)
    let messagesText = '';
    if (settings.welcome_message) {
      const truncated = settings.welcome_message.length > 100 
        ? settings.welcome_message.substring(0, 100) + '...'
        : settings.welcome_message;
      messagesText += `**Welcome:** ${truncated}\n`;
    }
    if (settings.close_message) {
      const truncated = settings.close_message.length > 100
        ? settings.close_message.substring(0, 100) + '...'
        : settings.close_message;
      messagesText += `**Close:** ${truncated}`;
    }

    if (messagesText) {
      embed.addFields({
        name: '💬 Custom Messages',
        value: messagesText,
        inline: false
      });
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error viewing ticket settings:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to load ticket settings.')]
    });
  }
}

async function handleEnableToggle(interaction: CommandInteraction) {
  if (!interaction.guild) return;

  const enabled = interaction.options.getBoolean('enabled', true);

  await interaction.deferReply();

  try {
    await db.query(
      `INSERT INTO ticket_settings (guild_id, enabled) 
       VALUES ($1, $2) 
       ON CONFLICT (guild_id) 
       DO UPDATE SET enabled = $2, updated_at = CURRENT_TIMESTAMP`,
      [interaction.guild.id, enabled]
    );

    const embed = createSuccessEmbed(
      '✅ Settings Updated',
      `Ticket system has been **${enabled ? 'enabled' : 'disabled'}** for this server.`
    );

    if (enabled) {
      embed.addFields({
        name: '📝 Next Steps',
        value: '• Create a ticket panel with `/panel create`\n' +
               '• Configure categories with `/ticket category create`\n' +
               '• Set up support roles with `/ticket-settings roles`',
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error updating ticket settings:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to update ticket settings.')]
    });
  }
}

async function handleLimitsConfig(interaction: CommandInteraction) {
  if (!interaction.guild) return;

  const maxTickets = interaction.options.getInteger('max_tickets_per_user');
  const autoCloseHours = interaction.options.getInteger('auto_close_hours');
  const warningHours = interaction.options.getInteger('warning_hours');

  if (!maxTickets && !autoCloseHours && !warningHours) {
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Please specify at least one setting to update.')],
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply();

  try {
    const updates: string[] = [];
    const values: any[] = [interaction.guild.id];
    let valueIndex = 2;

    if (maxTickets !== null) {
      updates.push(`max_tickets_per_user = $${valueIndex}`);
      values.push(maxTickets);
      valueIndex++;
    }

    if (autoCloseHours !== null) {
      updates.push(`auto_close_time_hours = $${valueIndex}`);
      values.push(autoCloseHours);
      valueIndex++;
    }

    if (warningHours !== null) {
      updates.push(`auto_close_warning_hours = $${valueIndex}`);
      values.push(warningHours);
      valueIndex++;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    await db.query(
      `INSERT INTO ticket_settings (guild_id, max_tickets_per_user, auto_close_time_hours, auto_close_warning_hours) 
       VALUES ($1, ${maxTickets || 5}, ${autoCloseHours || 72}, ${warningHours || 48}) 
       ON CONFLICT (guild_id) 
       DO UPDATE SET ${updates.join(', ')}`,
      values
    );

    let description = 'Updated ticket limits:\n';
    if (maxTickets !== null) description += `• **Max tickets per user:** ${maxTickets}\n`;
    if (autoCloseHours !== null) description += `• **Auto-close after:** ${autoCloseHours} hours\n`;
    if (warningHours !== null) description += `• **Warning before auto-close:** ${warningHours} hours\n`;

    const embed = createSuccessEmbed('✅ Limits Updated', description);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error updating ticket limits:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to update ticket limits.')]
    });
  }
}

async function handleRolesConfig(interaction: CommandInteraction) {
  if (!interaction.guild) return;

  const supportRole = interaction.options.getRole('support_role') as Role;
  const adminRole = interaction.options.getRole('admin_role') as Role;
  const pingRole = interaction.options.getRole('ping_role') as Role;
  const action = interaction.options.getString('action') || 'add';

  if (!supportRole && !adminRole && !pingRole && action !== 'clear') {
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Please specify at least one role or use the clear action.')],
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply();

  try {
    const settings = await ticketHandler.getTicketSettings(interaction.guild.id);
    
    let supportRoles = [...settings.support_roles];
    let adminRoles = [...settings.admin_roles];
    let pingRoles = [...settings.ping_roles];

    if (action === 'clear') {
      supportRoles = [];
      adminRoles = [];
      pingRoles = [];
    } else {
      if (supportRole) {
        if (action === 'add' && !supportRoles.includes(supportRole.id)) {
          supportRoles.push(supportRole.id);
        } else if (action === 'remove') {
          supportRoles = supportRoles.filter(id => id !== supportRole.id);
        }
      }

      if (adminRole) {
        if (action === 'add' && !adminRoles.includes(adminRole.id)) {
          adminRoles.push(adminRole.id);
        } else if (action === 'remove') {
          adminRoles = adminRoles.filter(id => id !== adminRole.id);
        }
      }

      if (pingRole) {
        if (action === 'add' && !pingRoles.includes(pingRole.id)) {
          pingRoles.push(pingRole.id);
        } else if (action === 'remove') {
          pingRoles = pingRoles.filter(id => id !== pingRole.id);
        }
      }
    }

    await db.query(
      `INSERT INTO ticket_settings (guild_id, support_roles, admin_roles, ping_roles) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (guild_id) 
       DO UPDATE SET support_roles = $2, admin_roles = $3, ping_roles = $4, updated_at = CURRENT_TIMESTAMP`,
      [interaction.guild.id, supportRoles, adminRoles, pingRoles]
    );

    let description = `**Action:** ${action.charAt(0).toUpperCase() + action.slice(1)}\n\n`;
    description += '**Current Configuration:**\n';
    description += `• **Support Roles:** ${supportRoles.length > 0 ? supportRoles.map(id => `<@&${id}>`).join(', ') : 'None'}\n`;
    description += `• **Admin Roles:** ${adminRoles.length > 0 ? adminRoles.map(id => `<@&${id}>`).join(', ') : 'None'}\n`;
    description += `• **Ping Roles:** ${pingRoles.length > 0 ? pingRoles.map(id => `<@&${id}>`).join(', ') : 'None'}`;

    const embed = createSuccessEmbed('✅ Roles Updated', description);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error updating ticket roles:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to update ticket roles.')]
    });
  }
}

async function handleChannelsConfig(interaction: CommandInteraction) {
  if (!interaction.guild) return;

  const transcriptChannel = interaction.options.getChannel('transcript_channel');
  const logChannel = interaction.options.getChannel('log_channel');
  const autoTranscript = interaction.options.getBoolean('auto_transcript');

  if (!transcriptChannel && !logChannel && autoTranscript === null) {
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Please specify at least one setting to update.')],
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply();

  try {
    const updates: string[] = [];
    const values: any[] = [interaction.guild.id];
    let valueIndex = 2;

    if (transcriptChannel) {
      updates.push(`transcript_channel_id = $${valueIndex}`);
      values.push(transcriptChannel.id);
      valueIndex++;
    }

    if (logChannel) {
      updates.push(`log_channel_id = $${valueIndex}`);
      values.push(logChannel.id);
      valueIndex++;
    }

    if (autoTranscript !== null) {
      updates.push(`auto_transcript = $${valueIndex}`);
      values.push(autoTranscript);
      valueIndex++;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const currentSettings = await ticketHandler.getTicketSettings(interaction.guild.id);

    await db.query(
      `INSERT INTO ticket_settings (guild_id, transcript_channel_id, log_channel_id, auto_transcript) 
       VALUES ($1, ${transcriptChannel?.id || null}, ${logChannel?.id || null}, ${autoTranscript ?? true}) 
       ON CONFLICT (guild_id) 
       DO UPDATE SET ${updates.join(', ')}`,
      values
    );

    let description = 'Updated channel settings:\n';
    if (transcriptChannel) description += `• **Transcript Channel:** ${transcriptChannel}\n`;
    if (logChannel) description += `• **Log Channel:** ${logChannel}\n`;
    if (autoTranscript !== null) description += `• **Auto-transcript:** ${autoTranscript ? 'Enabled' : 'Disabled'}\n`;

    const embed = createSuccessEmbed('✅ Channels Updated', description);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error updating ticket channels:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to update ticket channels.')]
    });
  }
}

async function handleMessagesConfig(interaction: CommandInteraction) {
  if (!interaction.guild) return;

  const welcomeMessage = interaction.options.getString('welcome_message');
  const closeMessage = interaction.options.getString('close_message');

  if (!welcomeMessage && !closeMessage) {
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Please specify at least one message to update.')],
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply();

  try {
    const updates: string[] = [];
    const values: any[] = [interaction.guild.id];
    let valueIndex = 2;

    if (welcomeMessage) {
      updates.push(`welcome_message = $${valueIndex}`);
      values.push(welcomeMessage);
      valueIndex++;
    }

    if (closeMessage) {
      updates.push(`close_message = $${valueIndex}`);
      values.push(closeMessage);
      valueIndex++;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    await db.query(
      `INSERT INTO ticket_settings (guild_id, welcome_message, close_message) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (guild_id) 
       DO UPDATE SET ${updates.join(', ')}`,
      values
    );

    let description = 'Updated custom messages:\n';
    if (welcomeMessage) description += `• **Welcome Message:** Updated\n`;
    if (closeMessage) description += `• **Close Message:** Updated\n`;

    const embed = createSuccessEmbed('✅ Messages Updated', description);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error updating ticket messages:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to update ticket messages.')]
    });
  }
}

async function handleRateLimitConfig(interaction: CommandInteraction) {
  if (!interaction.guild) return;

  const enabled = interaction.options.getBoolean('enabled');
  const limit = interaction.options.getInteger('limit');
  const windowMinutes = interaction.options.getInteger('window_minutes');

  if (enabled === null && !limit && !windowMinutes) {
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Please specify at least one rate limiting setting to update.')],
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply();

  try {
    const updates: string[] = [];
    const values: any[] = [interaction.guild.id];
    let valueIndex = 2;

    if (enabled !== null) {
      updates.push(`rate_limit_enabled = $${valueIndex}`);
      values.push(enabled);
      valueIndex++;
    }

    if (limit !== null) {
      updates.push(`rate_limit_count = $${valueIndex}`);
      values.push(limit);
      valueIndex++;
    }

    if (windowMinutes !== null) {
      updates.push(`rate_limit_window_minutes = $${valueIndex}`);
      values.push(windowMinutes);
      valueIndex++;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    await db.query(
      `INSERT INTO ticket_settings (guild_id, rate_limit_enabled, rate_limit_count, rate_limit_window_minutes) 
       VALUES ($1, ${enabled ?? true}, ${limit || 3}, ${windowMinutes || 60}) 
       ON CONFLICT (guild_id) 
       DO UPDATE SET ${updates.join(', ')}`,
      values
    );

    let description = 'Updated rate limiting settings:\n';
    if (enabled !== null) description += `• **Rate Limiting:** ${enabled ? 'Enabled' : 'Disabled'}\n`;
    if (limit !== null) description += `• **Limit:** ${limit} tickets\n`;
    if (windowMinutes !== null) description += `• **Time Window:** ${windowMinutes} minutes\n`;

    const embed = createSuccessEmbed('✅ Rate Limiting Updated', description);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error updating rate limiting:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to update rate limiting settings.')]
    });
  }
}