import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, hasPermission, canModerate, parseDuration, formatTime } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Timeout or remove timeout from users')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Timeout a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to timeout')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('duration')
          .setDescription('Timeout duration (e.g., 1h, 30m, 1d) - max 28 days')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the timeout')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove timeout from a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to remove timeout from')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for removing timeout')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('check')
      .setDescription('Check a user\'s timeout status')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to check timeout for')
          .setRequired(true)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  const member = interaction.member as GuildMember;

  if (!hasPermission(member, PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You need the Timeout Members permission to use this command.')],
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser('user', true);

  try {
    const targetMember = await interaction.guild.members.fetch(targetUser.id);

    if (!canModerate(member, targetMember)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot timeout this user.')],
        ephemeral: true,
      });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot timeout yourself.')],
        ephemeral: true,
      });
    }

    switch (subcommand) {
      case 'add': {
        const duration = interaction.options.getString('duration', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';

        let durationMs: number;
        try {
          durationMs = parseDuration(duration);
        } catch (error) {
          return interaction.reply({
            embeds: [createErrorEmbed('Error', 'Invalid duration format. Use formats like: 1h, 30m, 2d')],
            ephemeral: true,
          });
        }

        // Discord timeout limit is 28 days
        const maxTimeout = 28 * 24 * 60 * 60 * 1000; // 28 days in ms
        if (durationMs > maxTimeout) {
          return interaction.reply({
            embeds: [createErrorEmbed('Error', 'Timeout duration cannot exceed 28 days.')],
            ephemeral: true,
          });
        }

        if (durationMs < 1000) {
          return interaction.reply({
            embeds: [createErrorEmbed('Error', 'Timeout duration must be at least 1 second.')],
            ephemeral: true,
          });
        }

        if (targetMember.isCommunicationDisabled()) {
          const currentTimeout = targetMember.communicationDisabledUntil;
          return interaction.reply({
            embeds: [createErrorEmbed('Error', `**${targetUser.username}** is already timed out until <t:${Math.floor(currentTimeout!.getTime() / 1000)}:F>.`)],
            ephemeral: true,
          });
        }

        const timeoutUntil = new Date(Date.now() + durationMs);

        await targetMember.timeout(durationMs, `Timeout by ${interaction.user.tag}: ${reason}`);

        // Log the action
        await db.query(
          `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, duration, expires_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            interaction.guild.id,
            targetUser.id,
            interaction.user.id,
            'timeout',
            reason,
            durationMs,
            timeoutUntil,
          ]
        );

        const embed = createSuccessEmbed(
          'User Timed Out',
          `${emojis.timeout} **${targetUser.username}** has been timed out.`
        );

        embed.addFields(
          { name: 'User', value: `${targetUser} (${targetUser.username})`, inline: true },
          { name: 'Moderator', value: `${interaction.user}`, inline: true },
          { name: 'Duration', value: formatTime(durationMs), inline: true },
          { name: 'Expires', value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        );

        await interaction.reply({ embeds: [embed] });

        // Try to notify the user
        try {
          const dmEmbed = createErrorEmbed(
            'You have been timed out',
            `You have been timed out in **${interaction.guild.name}**.`
          );

          dmEmbed.addFields(
            { name: 'Duration', value: formatTime(durationMs), inline: true },
            { name: 'Expires', value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`, inline: true },
            { name: 'Moderator', value: interaction.user.username, inline: true },
            { name: 'Reason', value: reason, inline: false }
          );

          await targetUser.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.log('Could not send DM to timed out user');
        }

        // Send to log channel
        const settings = await db.query(
          'SELECT log_channel FROM guild_settings WHERE guild_id = $1',
          [interaction.guild.id]
        );

        if (settings.rows[0]?.log_channel) {
          const logChannel = interaction.guild.channels.cache.get(settings.rows[0].log_channel);
          if (logChannel?.isTextBased()) {
            await logChannel.send({ embeds: [embed] });
          }
        }

        break;
      }

      case 'remove': {
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!targetMember.isCommunicationDisabled()) {
          return interaction.reply({
            embeds: [createErrorEmbed('Error', `**${targetUser.username}** is not currently timed out.`)],
            ephemeral: true,
          });
        }

        await targetMember.timeout(null, `Timeout removed by ${interaction.user.tag}: ${reason}`);

        // Log the action
        await db.query(
          `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            interaction.guild.id,
            targetUser.id,
            interaction.user.id,
            'timeout_remove',
            reason,
          ]
        );

        const embed = createSuccessEmbed(
          'Timeout Removed',
          `${emojis.success} Removed timeout from **${targetUser.username}**.`
        );

        embed.addFields(
          { name: 'User', value: `${targetUser} (${targetUser.username})`, inline: true },
          { name: 'Moderator', value: `${interaction.user}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        );

        await interaction.reply({ embeds: [embed] });

        // Try to notify the user
        try {
          const dmEmbed = createSuccessEmbed(
            'Timeout Removed',
            `Your timeout in **${interaction.guild.name}** has been removed.`
          );

          dmEmbed.addFields(
            { name: 'Moderator', value: interaction.user.username, inline: true },
            { name: 'Reason', value: reason, inline: false }
          );

          await targetUser.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.log('Could not send DM to user about timeout removal');
        }

        // Send to log channel
        const settings = await db.query(
          'SELECT log_channel FROM guild_settings WHERE guild_id = $1',
          [interaction.guild.id]
        );

        if (settings.rows[0]?.log_channel) {
          const logChannel = interaction.guild.channels.cache.get(settings.rows[0].log_channel);
          if (logChannel?.isTextBased()) {
            await logChannel.send({ embeds: [embed] });
          }
        }

        break;
      }

      case 'check': {
        const embed = createSuccessEmbed(
          'Timeout Status',
          targetMember.isCommunicationDisabled()
            ? `${emojis.timeout} **${targetUser.username}** is currently timed out.`
            : `${emojis.success} **${targetUser.username}** is not timed out.`
        );

        embed.addFields(
          { name: 'User', value: `${targetUser} (${targetUser.username})`, inline: true }
        );

        if (targetMember.isCommunicationDisabled()) {
          const timeoutUntil = targetMember.communicationDisabledUntil!;
          const remainingTime = timeoutUntil.getTime() - Date.now();

          embed.addFields(
            { name: 'Status', value: 'Timed Out', inline: true },
            { name: 'Expires', value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`, inline: true },
            { name: 'Remaining Time', value: formatTime(remainingTime), inline: true }
          );
        } else {
          embed.addFields(
            { name: 'Status', value: 'Not Timed Out', inline: true }
          );
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }
    }

  } catch (error: any) {
    console.error('Error managing timeout:', error);
    
    let errorMessage = 'Failed to manage timeout. Please check my permissions and try again.';
    
    if (error.code === 50013) {
      errorMessage = 'I don\'t have permission to timeout this user. They may have a higher role than me.';
    } else if (error.code === 50035) {
      errorMessage = 'Invalid timeout duration provided.';
    }

    await interaction.reply({
      embeds: [createErrorEmbed('Error', errorMessage)],
      ephemeral: true,
    });
  }
}