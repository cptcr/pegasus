import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, EmbedBuilder } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, hasPermission, formatTimeAgo, chunkArray } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis, colors } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('case')
  .setDescription('View and manage moderation cases')
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View a specific moderation case')
      .addIntegerOption(option =>
        option.setName('case_id')
          .setDescription('Case ID to view')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Edit a moderation case reason')
      .addIntegerOption(option =>
        option.setName('case_id')
          .setDescription('Case ID to edit')
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('New reason for the case')
          .setRequired(true)
          .setMaxLength(1000)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete a moderation case')
      .addIntegerOption(option =>
        option.setName('case_id')
          .setDescription('Case ID to delete')
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for deleting the case')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('search')
      .setDescription('Search moderation cases')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('Search cases for a specific user')
          .setRequired(false)
      )
      .addUserOption(option =>
        option.setName('moderator')
          .setDescription('Search cases by a specific moderator')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('action')
          .setDescription('Search cases by action type')
          .setRequired(false)
          .addChoices(
            { name: 'Ban', value: 'ban' },
            { name: 'Kick', value: 'kick' },
            { name: 'Mute', value: 'mute' },
            { name: 'Warn', value: 'warn' },
            { name: 'Timeout', value: 'timeout' },
            { name: 'Purge', value: 'purge' },
            { name: 'Nickname Change', value: 'nickname_change' },
            { name: 'Role Add', value: 'role_add' },
            { name: 'Role Remove', value: 'role_remove' }
          )
      )
      .addIntegerOption(option =>
        option.setName('limit')
          .setDescription('Number of cases to show (1-20)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(20)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('history')
      .setDescription('View moderation history for a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to view history for')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('limit')
          .setDescription('Number of cases to show (1-20)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(20)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  const member = interaction.member as GuildMember;

  if (!hasPermission(member, PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You need the Manage Messages permission to use this command.')],
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'view': {
        const caseId = interaction.options.getInteger('case_id', true);

        const result = await db.query(
          `SELECT * FROM mod_actions WHERE guild_id = $1 AND id = $2`,
          [interaction.guild.id, caseId]
        );

        if (result.rows.length === 0) {
          return interaction.reply({
            embeds: [createErrorEmbed('Error', `Case #${caseId} not found.`)],
            ephemeral: true,
          });
        }

        const modCase = result.rows[0];
        const embed = new EmbedBuilder()
          .setTitle(`${emojis.info} Moderation Case #${modCase.id}`)
          .setColor(colors.info)
          .setTimestamp(modCase.created_at);

        // Get action emoji
        const actionEmojis: { [key: string]: string } = {
          ban: emojis.ban || '🔨',
          kick: emojis.kick || '👢',
          mute: emojis.mute || '🔇',
          warn: emojis.warning || '⚠️',
          timeout: emojis.timeout || '⏰',
          purge: emojis.delete || '🗑️',
          nickname_change: emojis.edit || '✏️',
          role_add: '➕',
          role_remove: '➖',
        };

        embed.addFields(
          { name: 'Action', value: `${actionEmojis[modCase.action] || '📝'} ${modCase.action.replace('_', ' ').toUpperCase()}`, inline: true },
          { name: 'User', value: modCase.user_id ? `<@${modCase.user_id}> (${modCase.user_id})` : 'N/A', inline: true },
          { name: 'Moderator', value: `<@${modCase.moderator_id}> (${modCase.moderator_id})`, inline: true },
          { name: 'Reason', value: modCase.reason || 'No reason provided', inline: false }
        );

        if (modCase.duration) {
          embed.addFields({ name: 'Duration', value: `${Math.floor(modCase.duration / 1000)}s`, inline: true });
        }

        if (modCase.expires_at) {
          embed.addFields({ name: 'Expires', value: `<t:${Math.floor(new Date(modCase.expires_at).getTime() / 1000)}:F>`, inline: true });
        }

        if (modCase.channel_id) {
          embed.addFields({ name: 'Channel', value: `<#${modCase.channel_id}>`, inline: true });
        }

        if (modCase.metadata) {
          try {
            const metadata = JSON.parse(modCase.metadata);
            const metadataText = Object.entries(metadata)
              .map(([key, value]) => `**${key}:** ${value}`)
              .join('\n');
            embed.addFields({ name: 'Additional Info', value: metadataText, inline: false });
          } catch (error) {
            // Ignore JSON parse errors
          }
        }

        embed.addFields({ name: 'Date', value: formatTimeAgo(modCase.created_at), inline: true });

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'edit': {
        const caseId = interaction.options.getInteger('case_id', true);
        const newReason = interaction.options.getString('reason', true);

        const result = await db.query(
          `SELECT * FROM mod_actions WHERE guild_id = $1 AND id = $2`,
          [interaction.guild.id, caseId]
        );

        if (result.rows.length === 0) {
          return interaction.reply({
            embeds: [createErrorEmbed('Error', `Case #${caseId} not found.`)],
            ephemeral: true,
          });
        }

        const modCase = result.rows[0];
        const oldReason = modCase.reason;

        await db.query(
          `UPDATE mod_actions SET reason = $1, updated_at = NOW() WHERE guild_id = $2 AND id = $3`,
          [newReason, interaction.guild.id, caseId]
        );

        // Log the edit
        await db.query(
          `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, metadata) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            interaction.guild.id,
            null,
            interaction.user.id,
            'case_edit',
            `Edited case #${caseId}`,
            JSON.stringify({
              case_id: caseId,
              old_reason: oldReason,
              new_reason: newReason,
            }),
          ]
        );

        const embed = createSuccessEmbed(
          'Case Updated',
          `${emojis.edit} Successfully updated case #${caseId}.`
        );

        embed.addFields(
          { name: 'Case ID', value: caseId.toString(), inline: true },
          { name: 'Editor', value: `${interaction.user}`, inline: true },
          { name: 'Old Reason', value: oldReason || 'No reason provided', inline: false },
          { name: 'New Reason', value: newReason, inline: false }
        );

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'delete': {
        const caseId = interaction.options.getInteger('case_id', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const result = await db.query(
          `SELECT * FROM mod_actions WHERE guild_id = $1 AND id = $2`,
          [interaction.guild.id, caseId]
        );

        if (result.rows.length === 0) {
          return interaction.reply({
            embeds: [createErrorEmbed('Error', `Case #${caseId} not found.`)],
            ephemeral: true,
          });
        }

        const modCase = result.rows[0];

        // Check if user can delete this case (only moderators or the case creator)
        if (!hasPermission(member, PermissionFlagsBits.Administrator) && 
            modCase.moderator_id !== interaction.user.id) {
          return interaction.reply({
            embeds: [createErrorEmbed('Error', 'You can only delete cases you created, or you need Administrator permission.')],
            ephemeral: true,
          });
        }

        await db.query(
          `DELETE FROM mod_actions WHERE guild_id = $1 AND id = $2`,
          [interaction.guild.id, caseId]
        );

        // Log the deletion
        await db.query(
          `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, metadata) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            interaction.guild.id,
            null,
            interaction.user.id,
            'case_delete',
            reason,
            JSON.stringify({
              deleted_case_id: caseId,
              deleted_case_action: modCase.action,
              deleted_case_reason: modCase.reason,
            }),
          ]
        );

        const embed = createSuccessEmbed(
          'Case Deleted',
          `${emojis.delete} Successfully deleted case #${caseId}.`
        );

        embed.addFields(
          { name: 'Case ID', value: caseId.toString(), inline: true },
          { name: 'Deleted by', value: `${interaction.user}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        );

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'search': {
        const targetUser = interaction.options.getUser('user');
        const moderator = interaction.options.getUser('moderator');
        const action = interaction.options.getString('action');
        const limit = interaction.options.getInteger('limit') || 10;

        let query = `SELECT * FROM mod_actions WHERE guild_id = $1`;
        let params: any[] = [interaction.guild.id];
        let paramIndex = 2;

        if (targetUser) {
          query += ` AND user_id = $${paramIndex}`;
          params.push(targetUser.id);
          paramIndex++;
        }

        if (moderator) {
          query += ` AND moderator_id = $${paramIndex}`;
          params.push(moderator.id);
          paramIndex++;
        }

        if (action) {
          query += ` AND action = $${paramIndex}`;
          params.push(action);
          paramIndex++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
          return interaction.reply({
            embeds: [createErrorEmbed('No Results', 'No moderation cases found matching your criteria.')],
            ephemeral: true,
          });
        }

        const embed = createSuccessEmbed(
          'Case Search Results',
          `Found ${result.rows.length} case${result.rows.length === 1 ? '' : 's'} matching your criteria.`
        );

        const cases = result.rows.slice(0, 15).map((modCase: any) => {
          const actionEmojis: { [key: string]: string } = {
            ban: emojis.ban || '🔨',
            kick: emojis.kick || '👢',
            mute: emojis.mute || '🔇',
            warn: emojis.warning || '⚠️',
            timeout: emojis.timeout || '⏰',
          };

          return `**#${modCase.id}** ${actionEmojis[modCase.action] || '📝'} ${modCase.action} - <@${modCase.user_id || 'N/A'}> - ${formatTimeAgo(modCase.created_at)}`;
        }).join('\n');

        embed.addFields({ name: 'Cases', value: cases, inline: false });

        if (result.rows.length > 15) {
          embed.setFooter({ text: `Showing first 15 of ${result.rows.length} results. Use /case view [id] for details.` });
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'history': {
        const targetUser = interaction.options.getUser('user', true);
        const limit = interaction.options.getInteger('limit') || 10;

        const result = await db.query(
          `SELECT * FROM mod_actions WHERE guild_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT $3`,
          [interaction.guild.id, targetUser.id, limit]
        );

        if (result.rows.length === 0) {
          return interaction.reply({
            embeds: [createErrorEmbed('No History', `${targetUser.username} has no moderation history.`)],
            ephemeral: true,
          });
        }

        const embed = createSuccessEmbed(
          'Moderation History',
          `${targetUser.username} has ${result.rows.length} moderation case${result.rows.length === 1 ? '' : 's'}.`
        );

        embed.setThumbnail(targetUser.displayAvatarURL());

        const cases = result.rows.map((modCase: any) => {
          const actionEmojis: { [key: string]: string } = {
            ban: emojis.ban || '🔨',
            kick: emojis.kick || '👢',
            mute: emojis.mute || '🔇',
            warn: emojis.warning || '⚠️',
            timeout: emojis.timeout || '⏰',
          };

          return `**#${modCase.id}** ${actionEmojis[modCase.action] || '📝'} ${modCase.action} - <@${modCase.moderator_id}> - ${formatTimeAgo(modCase.created_at)}`;
        }).join('\n');

        embed.addFields(
          { name: 'User', value: `${targetUser} (${targetUser.username})`, inline: true },
          { name: 'Total Cases', value: result.rows.length.toString(), inline: true },
          { name: 'Recent Cases', value: cases, inline: false }
        );

        await interaction.reply({ embeds: [embed] });
        break;
      }
    }

  } catch (error) {
    console.error('Error managing cases:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to manage moderation case. Please try again.')],
      ephemeral: true,
    });
  }
}