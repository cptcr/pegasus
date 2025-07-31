import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, Role, Events } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, hasPermission } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('autorole')
  .setDescription('Manage automatic role assignment for new members')
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Set the auto role for new members')
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Role to automatically assign to new members')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove the current auto role')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Check current auto role settings')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('toggle')
      .setDescription('Enable or disable the auto role system')
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Enable or disable auto role')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('test')
      .setDescription('Test auto role assignment on a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to test auto role on')
          .setRequired(true)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  const member = interaction.member as GuildMember;

  if (!hasPermission(member, PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You need the Manage Roles permission to use this command.')],
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
      case 'set':
        await handleSetAutorole(interaction);
        break;
      case 'remove':
        await handleRemoveAutorole(interaction);
        break;
      case 'status':
        await handleStatusAutorole(interaction);
        break;
      case 'toggle':
        await handleToggleAutorole(interaction);
        break;
      case 'test':
        await handleTestAutorole(interaction);
        break;
    }

  } catch (error) {
    console.error('Error managing autorole:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to manage auto role. Please try again.')],
      ephemeral: true,
    });
  }
}

async function handleSetAutorole(interaction: any) {
  const role = interaction.options.getRole('role', true) as Role;

  // Validation checks
  if (role.id === interaction.guild.roles.everyone.id) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You cannot set @everyone as the auto role.')],
      ephemeral: true,
    });
  }

  if (role.managed) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You cannot set a managed role (bot/integration role) as the auto role.')],
      ephemeral: true,
    });
  }

  if (role.position >= interaction.guild.members.me!.roles.highest.position) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'I cannot assign this role as it is higher than my highest role.')],
      ephemeral: true,
    });
  }

  if (role.position >= (interaction.member as GuildMember).roles.highest.position && 
      interaction.user.id !== interaction.guild.ownerId) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You cannot set a role that is higher than your highest role as the auto role.')],
      ephemeral: true,
    });
  }

  // Check if bot has permission to assign the role
  if (!interaction.guild.members.me!.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'I need the "Manage Roles" permission to assign auto roles.')],
      ephemeral: true,
    });
  }

  await db.query(
    `UPDATE guild_settings SET autorole_id = $1, autorole_enabled = true WHERE guild_id = $2`,
    [role.id, interaction.guild.id]
  );

  const embed = createSuccessEmbed(
    'Auto Role Set',
    `${emojis.role} **${role.name}** will now be automatically assigned to new members.`
  );

  embed.addFields(
    { name: 'Role', value: `${role}`, inline: true },
    { name: 'Status', value: 'Enabled', inline: true },
    { name: 'Position', value: `${role.position}`, inline: true }
  );

  embed.setFooter({ text: 'Auto role system is now enabled!' });

  await interaction.reply({ embeds: [embed] });

  // Log the action
  await db.query(
    `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, metadata) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      interaction.guild.id,
      null,
      interaction.user.id,
      'autorole_set',
      `Set auto role to ${role.name}`,
      JSON.stringify({
        role_id: role.id,
        role_name: role.name,
      }),
    ]
  );
}

async function handleRemoveAutorole(interaction: any) {
  const result = await db.query(
    'SELECT autorole_id FROM guild_settings WHERE guild_id = $1',
    [interaction.guild.id]
  );

  const currentAutorole = result.rows[0]?.autorole_id;

  if (!currentAutorole) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'No auto role is currently set.')],
      ephemeral: true,
    });
  }

  await db.query(
    `UPDATE guild_settings SET autorole_id = NULL, autorole_enabled = false WHERE guild_id = $1`,
    [interaction.guild.id]
  );

  const embed = createSuccessEmbed(
    'Auto Role Removed',
    `${emojis.success} Auto role has been removed and disabled.`
  );

  embed.addFields(
    { name: 'Previous Role', value: `<@&${currentAutorole}>`, inline: true },
    { name: 'Status', value: 'Disabled', inline: true }
  );

  await interaction.reply({ embeds: [embed] });

  // Log the action
  await db.query(
    `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, metadata) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      interaction.guild.id,
      null,
      interaction.user.id,
      'autorole_remove',
      'Auto role removed',
      JSON.stringify({
        previous_role_id: currentAutorole,
      }),
    ]
  );
}

async function handleStatusAutorole(interaction: any) {
  const result = await db.query(
    'SELECT autorole_id, autorole_enabled FROM guild_settings WHERE guild_id = $1',
    [interaction.guild.id]
  );

  const settings = result.rows[0] || {};
  const autoroleId = settings.autorole_id;
  const autoroleEnabled = settings.autorole_enabled || false;

  const embed = createSuccessEmbed(
    'Auto Role Status',
    `${emojis.info} Current auto role configuration for **${interaction.guild.name}**`
  );

  if (!autoroleId) {
    embed.addFields(
      { name: 'Status', value: '❌ Not configured', inline: true },
      { name: 'Role', value: 'None set', inline: true }
    );
  } else {
    const role = interaction.guild.roles.cache.get(autoroleId);
    
    embed.addFields(
      { name: 'Status', value: autoroleEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
      { name: 'Role', value: role ? `${role}` : `<@&${autoroleId}> (Role not found)`, inline: true },
      { name: 'Members with Role', value: role ? role.members.size.toString() : 'Unknown', inline: true }
    );

    if (role) {
      embed.addFields(
        { name: 'Role Info', value: [
          `**Position:** ${role.position}`,
          `**Color:** ${role.hexColor}`,
          `**Mentionable:** ${role.mentionable ? 'Yes' : 'No'}`,
          `**Managed:** ${role.managed ? 'Yes' : 'No'}`
        ].join('\n'), inline: false }
      );
    }
  }

  // Get recent joins and auto role assignments
  const recentActions = await db.query(
    `SELECT COUNT(*) as count FROM mod_actions 
     WHERE guild_id = $1 AND action = 'autorole_assign' 
     AND created_at > NOW() - INTERVAL '7 days'`,
    [interaction.guild.id]
  );

  const recentAssignments = recentActions.rows[0]?.count || 0;

  embed.addFields({
    name: 'Recent Activity',
    value: `**Auto roles assigned (7 days):** ${recentAssignments}`,
    inline: false
  });

  await interaction.reply({ embeds: [embed] });
}

async function handleToggleAutorole(interaction: any) {
  const enabled = interaction.options.getBoolean('enabled', true);

  const result = await db.query(
    'SELECT autorole_id FROM guild_settings WHERE guild_id = $1',
    [interaction.guild.id]
  );

  const currentAutorole = result.rows[0]?.autorole_id;

  if (!currentAutorole && enabled) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You must set an auto role first using `/autorole set`.')],
      ephemeral: true,
    });
  }

  await db.query(
    `UPDATE guild_settings SET autorole_enabled = $1 WHERE guild_id = $2`,
    [enabled, interaction.guild.id]
  );

  const embed = createSuccessEmbed(
    'Auto Role Toggled',
    `${emojis.success} Auto role system has been **${enabled ? 'enabled' : 'disabled'}**.`
  );

  if (currentAutorole) {
    embed.addFields(
      { name: 'Role', value: `<@&${currentAutorole}>`, inline: true },
      { name: 'Status', value: enabled ? '✅ Enabled' : '❌ Disabled', inline: true }
    );
  }

  await interaction.reply({ embeds: [embed] });

  // Log the action
  await db.query(
    `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, metadata) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      interaction.guild.id,
      null,
      interaction.user.id,
      'autorole_toggle',
      `Auto role ${enabled ? 'enabled' : 'disabled'}`,
      JSON.stringify({
        enabled,
        role_id: currentAutorole,
      }),
    ]
  );
}

async function handleTestAutorole(interaction: any) {
  const targetUser = interaction.options.getUser('user', true);

  const result = await db.query(
    'SELECT autorole_id, autorole_enabled FROM guild_settings WHERE guild_id = $1',
    [interaction.guild.id]
  );

  const settings = result.rows[0] || {};
  const autoroleId = settings.autorole_id;
  const autoroleEnabled = settings.autorole_enabled || false;

  if (!autoroleId) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'No auto role is configured.')],
      ephemeral: true,
    });
  }

  if (!autoroleEnabled) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'Auto role system is disabled.')],
      ephemeral: true,
    });
  }

  try {
    const targetMember = await interaction.guild.members.fetch(targetUser.id);
    const role = interaction.guild.roles.cache.get(autoroleId);

    if (!role) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'Auto role no longer exists.')],
        ephemeral: true,
      });
    }

    if (targetMember.roles.cache.has(autoroleId)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', `${targetUser.username} already has the auto role.`)],
        ephemeral: true,
      });
    }

    await targetMember.roles.add(role, `Auto role test by ${interaction.user.tag}`);

    const embed = createSuccessEmbed(
      'Auto Role Test Successful',
      `${emojis.success} Successfully assigned **${role.name}** to **${targetUser.username}**.`
    );

    embed.addFields(
      { name: 'User', value: `${targetUser}`, inline: true },
      { name: 'Role', value: `${role}`, inline: true },
      { name: 'Test Result', value: '✅ Success', inline: true }
    );

    await interaction.reply({ embeds: [embed] });

    // Log the test
    await db.query(
      `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        interaction.guild.id,
        targetUser.id,
        interaction.user.id,
        'autorole_test',
        'Auto role test assignment',
        JSON.stringify({
          role_id: role.id,
          role_name: role.name,
        }),
      ]
    );

  } catch (error: any) {
    console.error('Error testing autorole:', error);
    
    let errorMessage = 'Failed to assign auto role during test.';
    
    if (error.code === 50013) {
      errorMessage = 'I don\'t have permission to assign this role.';
    } else if (error.code === 50001) {
      errorMessage = 'I don\'t have access to this user or role.';
    }

    await interaction.reply({
      embeds: [createErrorEmbed('Test Failed', errorMessage)],
      ephemeral: true,
    });
  }
}