import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, parseDuration, formatTime, canModerate } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user from the server')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('The user to ban')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('The reason for the ban')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('duration')
      .setDescription('Duration of the ban (e.g., 1h, 30m, 7d)')
      .setRequired(false)
  )
  .addIntegerOption(option =>
    option.setName('delete_messages')
      .setDescription('Delete messages from the last X days (0-7)')
      .setMinValue(0)
      .setMaxValue(7)
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

export async function execute(interaction: any) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const duration = interaction.options.getString('duration');
    const deleteMessages = interaction.options.getInteger('delete_messages') || 0;

    if (!interaction.guild) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
        ephemeral: true,
      });
    }

    const member = interaction.member as GuildMember;
    const targetMember = interaction.guild.members.cache.get(user.id);

    if (targetMember && !canModerate(member, targetMember)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot ban this user.')],
        ephemeral: true,
      });
    }

    if (user.id === interaction.user.id) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot ban yourself.')],
        ephemeral: true,
      });
    }

    if (user.id === interaction.guild.ownerId) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot ban the server owner.')],
        ephemeral: true,
      });
    }

    try {
      let expiresAt: Date | null = null;
      if (duration) {
        const durationMs = parseDuration(duration);
        expiresAt = new Date(Date.now() + durationMs);
      }

      await interaction.guild.members.ban(user, {
        reason: `${reason} | Banned by ${interaction.user.tag}`,
        deleteMessageSeconds: deleteMessages * 24 * 60 * 60,
      });

      await db.query(
        `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, duration, expires_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          interaction.guild.id,
          user.id,
          interaction.user.id,
          'ban',
          reason,
          duration ? parseDuration(duration) : null,
          expiresAt,
        ]
      );

      const embed = createSuccessEmbed(
        'User Banned',
        `${emojis.ban} **${user.tag}** has been banned from the server.`
      );

      embed.addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      );

      if (duration) {
        embed.addFields({ name: 'Duration', value: formatTime(parseDuration(duration)), inline: true });
      }

      if (deleteMessages > 0) {
        embed.addFields({ name: 'Messages Deleted', value: `${deleteMessages} days`, inline: true });
      }

      await interaction.reply({ embeds: [embed] });

      try {
        await user.send({
          embeds: [
            createErrorEmbed(
              'You have been banned',
              `You have been banned from **${interaction.guild.name}**\n\n**Reason:** ${reason}${
                duration ? `\n**Duration:** ${formatTime(parseDuration(duration))}` : ''
              }`
            ),
          ],
        });
      } catch (error) {
        console.log('Could not send DM to banned user');
      }

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

    } catch (error) {
      console.error('Error banning user:', error);
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'Failed to ban the user. Please try again.')],
        ephemeral: true,
      });
    }
  }