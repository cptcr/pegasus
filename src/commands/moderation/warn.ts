import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, canModerate } from '../../utils/helpers';
import { Database } from '../../database/connection';
import { emojis, colors } from '../../utils/config';
import { WarningHistory, ModerationNote } from '../../types';
import { loggingHandler } from '../../handlers/logging';

const db = Database.getInstance();

export const data = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Advanced warning system with history tracking')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a warning to a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to warn')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('The reason for the warning')
            .setRequired(true)
            .setMaxLength(1000)
        )
        .addStringOption(option =>
          option.setName('evidence')
            .setDescription('Evidence URL or description')
            .setMaxLength(500)
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('severity')
            .setDescription('Severity level of the warning')
            .addChoices(
              { name: 'Low', value: 'low' },
              { name: 'Medium', value: 'medium' },
              { name: 'High', value: 'high' },
              { name: 'Critical', value: 'critical' }
            )
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit an existing warning')
        .addStringOption(option =>
          option.setName('warning_id')
            .setDescription('ID of the warning to edit')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('New reason for the warning')
            .setMaxLength(1000)
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('evidence')
            .setDescription('New evidence URL or description')
            .setMaxLength(500)
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('severity')
            .setDescription('New severity level')
            .addChoices(
              { name: 'Low', value: 'low' },
              { name: 'Medium', value: 'medium' },
              { name: 'High', value: 'high' },
              { name: 'Critical', value: 'critical' }
            )
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('edit_reason')
            .setDescription('Reason for editing this warning')
            .setMaxLength(500)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List warnings for a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to check warnings for')
            .setRequired(true)
        )
        .addBooleanOption(option =>
          option.setName('show_history')
            .setDescription('Include edit history in the response')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('View edit history for a specific warning')
        .addStringOption(option =>
          option.setName('warning_id')
            .setDescription('ID of the warning to view history for')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a warning')
        .addStringOption(option =>
          option.setName('warning_id')
            .setDescription('ID of the warning to remove')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for removing the warning')
            .setMaxLength(500)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('note')
        .setDescription('Add a moderation note to a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to add note for')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('note')
            .setDescription('The moderation note')
            .setMaxLength(1000)
            .setRequired(true)
        )
        .addBooleanOption(option =>
          option.setName('internal')
            .setDescription('Make this note internal (not visible to user)')
            .setRequired(false)
        )
    );

export async function execute(interaction: any) {
    if (!interaction.guild) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        await handleAdd(interaction);
        break;
      case 'edit':
        await handleEdit(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'history':
        await handleHistory(interaction);
        break;
      case 'remove':
        await handleRemove(interaction);
        break;
      case 'note':
        await handleNote(interaction);
        break;
    }
}

async function handleAdd(interaction: any) {
  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);
  const evidence = interaction.options.getString('evidence');
  const severity = interaction.options.getString('severity') || 'medium';

  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  
  if (member && !canModerate(interaction.member as GuildMember, member)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You cannot warn this user due to role hierarchy.')],
      ephemeral: true,
    });
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    // Insert warning into database
    const result = await db.query(
      `INSERT INTO warnings (guild_id, user_id, moderator_id, reason, evidence, severity)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [interaction.guild.id, user.id, interaction.user.id, reason, evidence, severity]
    );

    const warningId = result.rows[0].id;

    // Log the warning
    await loggingHandler.logModerationAction(
      interaction.guild.id,
      'warn',
      user,
      interaction.user,
      reason
    );

    // Send DM to user if possible
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`${emojis.warning} Warning Issued`)
        .setDescription(`You have been warned in **${interaction.guild.name}**`)
        .addFields([
          { name: 'Reason', value: reason, inline: false },
          { name: 'Severity', value: severity.toUpperCase(), inline: true },
          { name: 'Warning ID', value: warningId, inline: true }
        ])
        .setColor(severity === 'critical' ? colors.error as any : colors.warning as any)
        .setTimestamp();

      if (evidence) {
        dmEmbed.addFields([{ name: 'Evidence', value: evidence, inline: false }]);
      }

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // User has DMs disabled or left guild
    }

    await interaction.editReply({
      embeds: [createSuccessEmbed(
        'Warning Issued',
        `Successfully warned ${user.tag}\n\n**Warning ID:** ${warningId}\n**Reason:** ${reason}\n**Severity:** ${severity.toUpperCase()}`
      )],
    });
  } catch (error) {
    console.error('Error issuing warning:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to issue warning.')],
    });
  }
}

async function handleEdit(interaction: any) {
  const warningId = interaction.options.getString('warning_id', true);
  const newReason = interaction.options.getString('reason');
  const newEvidence = interaction.options.getString('evidence');
  const newSeverity = interaction.options.getString('severity');
  const editReason = interaction.options.getString('edit_reason') || 'No reason provided';

  if (!newReason && !newEvidence && !newSeverity) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You must specify at least one field to edit.')],
      ephemeral: true,
    });
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    // Get current warning
    const warningResult = await db.query(
      'SELECT * FROM warnings WHERE id = $1 AND guild_id = $2',
      [warningId, interaction.guild.id]
    );

    if (warningResult.rows.length === 0) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Warning not found.')],
      });
    }

    const currentWarning = warningResult.rows[0];
    const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];

    // Track changes and create history entries
    if (newReason && newReason !== currentWarning.reason) {
      changes.push({ field: 'reason', oldValue: currentWarning.reason, newValue: newReason });
      
      await db.query(
        'INSERT INTO warning_history (warning_id, field_changed, old_value, new_value, changed_by, reason) VALUES ($1, $2, $3, $4, $5, $6)',
        [warningId, 'reason', currentWarning.reason, newReason, interaction.user.id, editReason]
      );
    }

    if (newEvidence !== null && newEvidence !== currentWarning.evidence) {
      changes.push({ field: 'evidence', oldValue: currentWarning.evidence || 'None', newValue: newEvidence || 'None' });
      
      await db.query(
        'INSERT INTO warning_history (warning_id, field_changed, old_value, new_value, changed_by, reason) VALUES ($1, $2, $3, $4, $5, $6)',
        [warningId, 'evidence', currentWarning.evidence, newEvidence, interaction.user.id, editReason]
      );
    }

    if (newSeverity && newSeverity !== currentWarning.severity) {
      changes.push({ field: 'severity', oldValue: currentWarning.severity, newValue: newSeverity });
      
      await db.query(
        'INSERT INTO warning_history (warning_id, field_changed, old_value, new_value, changed_by, reason) VALUES ($1, $2, $3, $4, $5, $6)',
        [warningId, 'severity', currentWarning.severity, newSeverity, interaction.user.id, editReason]
      );
    }

    if (changes.length === 0) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('No Changes', 'The warning already has these values.')],
      });
    }

    // Update the warning
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (newReason) {
      updateFields.push(`reason = $${paramIndex++}`);
      updateValues.push(newReason);
    }
    if (newEvidence !== null) {
      updateFields.push(`evidence = $${paramIndex++}`);
      updateValues.push(newEvidence);
    }
    if (newSeverity) {
      updateFields.push(`severity = $${paramIndex++}`);
      updateValues.push(newSeverity);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(warningId, interaction.guild.id);

    await db.query(
      `UPDATE warnings SET ${updateFields.join(', ')} WHERE id = $${paramIndex++} AND guild_id = $${paramIndex++}`,
      updateValues
    );

    // Log the edit
    const targetUser = await interaction.guild.members.fetch(currentWarning.user_id).then((m: any) => m.user).catch(() => null);
    if (targetUser) {
      await loggingHandler.logModerationAction(
        interaction.guild.id,
        'warning_edit',
        targetUser,
        interaction.user,
        editReason
      );
    }

    const changesText = changes.map(c => `**${c.field}**: ${c.oldValue} → ${c.newValue}`).join('\n');

    await interaction.editReply({
      embeds: [createSuccessEmbed(
        'Warning Updated',
        `Successfully updated warning ${warningId}\n\n**Changes:**\n${changesText}\n\n**Edit Reason:** ${editReason}`
      )],
    });
  } catch (error) {
    console.error('Error editing warning:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to edit warning.')],
    });
  }
}

async function handleList(interaction: any) {
  const user = interaction.options.getUser('user', true);
  const showHistory = interaction.options.getBoolean('show_history') || false;

  try {
    await interaction.deferReply({ ephemeral: true });

    const warnings = await db.query(
      'SELECT * FROM warnings WHERE guild_id = $1 AND user_id = $2 ORDER BY created_at DESC',
      [interaction.guild.id, user.id]
    );

    if (warnings.rows.length === 0) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('No Warnings', `${user.tag} has no warnings.`)],
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.warning} Warnings for ${user.tag}`)
      .setColor(colors.warning as any)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(`Total warnings: ${warnings.rows.length}`)
      .setTimestamp();

    for (const warning of warnings.rows.slice(0, 5)) {
      let warningText = `**Reason:** ${warning.reason}\n**Severity:** ${warning.severity.toUpperCase()}\n**Date:** <t:${Math.floor(new Date(warning.created_at).getTime() / 1000)}:R>`;
      
      if (warning.evidence) {
        warningText += `\n**Evidence:** ${warning.evidence}`;
      }

      if (showHistory) {
        const history = await db.query(
          'SELECT * FROM warning_history WHERE warning_id = $1 ORDER BY changed_at DESC',
          [warning.id]
        );

        if (history.rows.length > 0) {
          warningText += `\n**Edits:** ${history.rows.length}`;
        }
      }

      embed.addFields([{
        name: `Warning ID: ${warning.id}`,
        value: warningText,
        inline: false
      }]);
    }

    if (warnings.rows.length > 5) {
      embed.setFooter({ text: `Showing 5 of ${warnings.rows.length} warnings` });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error listing warnings:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to retrieve warnings.')],
    });
  }
}

async function handleHistory(interaction: any) {
  const warningId = interaction.options.getString('warning_id', true);

  try {
    await interaction.deferReply({ ephemeral: true });

    const history = await db.query(
      'SELECT * FROM warning_history WHERE warning_id = $1 ORDER BY changed_at DESC',
      [warningId]
    );

    if (history.rows.length === 0) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('No History', 'This warning has no edit history.')],
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.history} Edit History for Warning ${warningId}`)
      .setColor(colors.primary as any)
      .setDescription(`Total edits: ${history.rows.length}`)
      .setTimestamp();

    for (const edit of history.rows.slice(0, 10)) {
      const moderator = await interaction.guild.members.fetch(edit.changed_by).catch(() => null);
      const moderatorName = moderator ? moderator.user.tag : `Unknown User (${edit.changed_by})`;

      embed.addFields([{
        name: `${edit.field_changed.toUpperCase()} Changed`,
        value: `**From:** ${edit.old_value || 'None'}\n**To:** ${edit.new_value || 'None'}\n**By:** ${moderatorName}\n**When:** <t:${Math.floor(new Date(edit.changed_at).getTime() / 1000)}:R>\n**Reason:** ${edit.reason || 'No reason provided'}`,
        inline: false
      }]);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error retrieving warning history:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to retrieve warning history.')],
    });
  }
}

async function handleRemove(interaction: any) {
  const warningId = interaction.options.getString('warning_id', true);
  const reason = interaction.options.getString('reason', true);

  try {
    await interaction.deferReply({ ephemeral: true });

    const warning = await db.query(
      'SELECT * FROM warnings WHERE id = $1 AND guild_id = $2',
      [warningId, interaction.guild.id]
    );

    if (warning.rows.length === 0) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Warning not found.')],
      });
    }

    // Add removal to history
    await db.query(
      'INSERT INTO warning_history (warning_id, field_changed, old_value, new_value, changed_by, reason) VALUES ($1, $2, $3, $4, $5, $6)',
      [warningId, 'status', 'active', 'removed', interaction.user.id, reason]
    );

    // Remove the warning
    await db.query(
      'DELETE FROM warnings WHERE id = $1 AND guild_id = $2',
      [warningId, interaction.guild.id]
    );

    // Log the removal
    const targetUser = await interaction.guild.members.fetch(warning.rows[0].user_id).then((m: any) => m.user).catch(() => null);
    if (targetUser) {
      await loggingHandler.logModerationAction(
        interaction.guild.id,
        'warning_remove',
        targetUser,
        interaction.user,
        reason
      );
    }

    await interaction.editReply({
      embeds: [createSuccessEmbed(
        'Warning Removed',
        `Successfully removed warning ${warningId}\n\n**Reason:** ${reason}`
      )],
    });
  } catch (error) {
    console.error('Error removing warning:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to remove warning.')],
    });
  }
}

async function handleNote(interaction: any) {
  const user = interaction.options.getUser('user', true);
  const note = interaction.options.getString('note', true);
  const internal = interaction.options.getBoolean('internal') || false;

  try {
    await interaction.deferReply({ ephemeral: true });

    const result = await db.query(
      'INSERT INTO moderation_notes (guild_id, user_id, moderator_id, note, internal) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [interaction.guild.id, user.id, interaction.user.id, note, internal]
    );

    const noteId = result.rows[0].id;

    await interaction.editReply({
      embeds: [createSuccessEmbed(
        'Note Added',
        `Successfully added ${internal ? 'internal ' : ''}moderation note for ${user.tag}\n\n**Note ID:** ${noteId}\n**Note:** ${note}`
      )],
    });
  } catch (error) {
    console.error('Error adding note:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to add moderation note.')],
    });
  }
}