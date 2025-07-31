import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, Role } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, hasPermission, canModerate } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('Manage user roles')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a role to a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to add role to')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Role to add')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for adding the role')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove a role from a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to remove role from')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Role to remove')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for removing the role')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all roles of a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to list roles for')
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
  const targetUser = interaction.options.getUser('user', true);

  try {
    const targetMember = await interaction.guild.members.fetch(targetUser.id);

    if (subcommand === 'list') {
      const roles = targetMember.roles.cache
        .filter((role: Role) => role.id !== interaction.guild.roles.everyone.id)
        .sort((a: Role, b: Role) => b.position - a.position)
        .map((role: Role) => `${role}`)
        .slice(0, 20); // Limit to 20 roles to avoid embed limits

      const embed = createSuccessEmbed(
        'User Roles',
        `${emojis.info} **${targetUser.username}** has ${roles.length} role${roles.length === 1 ? '' : 's'}.`
      );

      embed.addFields(
        { name: 'User', value: `${targetUser} (${targetUser.username})`, inline: true },
        { name: 'Total Roles', value: roles.length.toString(), inline: true },
        { name: 'Highest Role', value: targetMember.roles.highest.toString(), inline: true }
      );

      if (roles.length > 0) {
        embed.addFields({
          name: 'Roles',
          value: roles.join(', ') + (targetMember.roles.cache.size > 21 ? '\n*...and more*' : ''),
          inline: false
        });
      }

      return interaction.reply({ embeds: [embed] });
    }

    const targetRole = interaction.options.getRole('role', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Permission checks
    if (!canModerate(member, targetMember)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot manage this user\'s roles.')],
        ephemeral: true,
      });
    }

    if (targetRole.position >= member.roles.highest.position && member.id !== interaction.guild.ownerId) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot manage this role as it is higher than your highest role.')],
        ephemeral: true,
      });
    }

    if (targetRole.position >= interaction.guild.members.me!.roles.highest.position) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'I cannot manage this role as it is higher than my highest role.')],
        ephemeral: true,
      });
    }

    if (targetRole.managed) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'This role is managed by an integration and cannot be manually assigned.')],
        ephemeral: true,
      });
    }

    if (targetRole.id === interaction.guild.roles.everyone.id) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot manage the @everyone role.')],
        ephemeral: true,
      });
    }

    switch (subcommand) {
      case 'add': {
        if (targetMember.roles.cache.has(targetRole.id)) {
          return interaction.reply({
            embeds: [createErrorEmbed('Error', `**${targetUser.username}** already has the **${targetRole.name}** role.`)],
            ephemeral: true,
          });
        }

        await targetMember.roles.add(targetRole, `Role added by ${interaction.user.tag}: ${reason}`);

        // Log the action
        await db.query(
          `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, metadata) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            interaction.guild.id,
            targetUser.id,
            interaction.user.id,
            'role_add',
            reason,
            JSON.stringify({
              role_id: targetRole.id,
              role_name: targetRole.name,
            }),
          ]
        );

        const addEmbed = createSuccessEmbed(
          'Role Added',
          `${emojis.success} Added the **${targetRole.name}** role to **${targetUser.username}**.`
        );

        addEmbed.addFields(
          { name: 'User', value: `${targetUser} (${targetUser.username})`, inline: true },
          { name: 'Role', value: `${targetRole}`, inline: true },
          { name: 'Moderator', value: `${interaction.user}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        );

        await interaction.reply({ embeds: [addEmbed] });

        // Send to log channel
        const settings = await db.query(
          'SELECT log_channel FROM guild_settings WHERE guild_id = $1',
          [interaction.guild.id]
        );

        if (settings.rows[0]?.log_channel) {
          const logChannel = interaction.guild.channels.cache.get(settings.rows[0].log_channel);
          if (logChannel?.isTextBased()) {
            await logChannel.send({ embeds: [addEmbed] });
          }
        }

        break;
      }

      case 'remove': {
        if (!targetMember.roles.cache.has(targetRole.id)) {
          return interaction.reply({
            embeds: [createErrorEmbed('Error', `**${targetUser.username}** doesn't have the **${targetRole.name}** role.`)],
            ephemeral: true,
          });
        }

        await targetMember.roles.remove(targetRole, `Role removed by ${interaction.user.tag}: ${reason}`);

        // Log the action
        await db.query(
          `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, metadata) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            interaction.guild.id,
            targetUser.id,
            interaction.user.id,
            'role_remove',
            reason,
            JSON.stringify({
              role_id: targetRole.id,
              role_name: targetRole.name,
            }),
          ]
        );

        const removeEmbed = createSuccessEmbed(
          'Role Removed',
          `${emojis.success} Removed the **${targetRole.name}** role from **${targetUser.username}**.`
        );

        removeEmbed.addFields(
          { name: 'User', value: `${targetUser} (${targetUser.username})`, inline: true },
          { name: 'Role', value: `${targetRole}`, inline: true },
          { name: 'Moderator', value: `${interaction.user}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        );

        await interaction.reply({ embeds: [removeEmbed] });

        // Send to log channel
        const settings = await db.query(
          'SELECT log_channel FROM guild_settings WHERE guild_id = $1',
          [interaction.guild.id]
        );

        if (settings.rows[0]?.log_channel) {
          const logChannel = interaction.guild.channels.cache.get(settings.rows[0].log_channel);
          if (logChannel?.isTextBased()) {
            await logChannel.send({ embeds: [removeEmbed] });
          }
        }

        break;
      }
    }

    // Try to notify the user (for add/remove actions)
    if (subcommand !== 'list') {
      try {
        const dmEmbed = createSuccessEmbed(
          `Role ${subcommand === 'add' ? 'Added' : 'Removed'}`,
          `A role has been ${subcommand === 'add' ? 'added to' : 'removed from'} your account in **${interaction.guild.name}**.`
        );

        dmEmbed.addFields(
          { name: 'Role', value: targetRole.name, inline: true },
          { name: 'Moderator', value: interaction.user.username, inline: true },
          { name: 'Reason', value: reason, inline: false }
        );

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log('Could not send DM to user about role change');
      }
    }

  } catch (error: any) {
    console.error('Error managing roles:', error);
    
    let errorMessage = 'Failed to manage role. Please check my permissions and try again.';
    
    if (error.code === 50013) {
      errorMessage = 'I don\'t have permission to manage this role or user.';
    } else if (error.code === 50001) {
      errorMessage = 'I don\'t have access to perform this action.';
    }

    await interaction.reply({
      embeds: [createErrorEmbed('Error', errorMessage)],
      ephemeral: true,
    });
  }
}