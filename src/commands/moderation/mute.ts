import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, parseDuration, formatTime, canModerate } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user in the server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to mute')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Duration of the mute (e.g., 1h, 30m, 7d)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for the mute')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false);

export async function execute(interaction: any) {
    const user = interaction.options.getUser('user', true);
    const duration = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!interaction.guild) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
        ephemeral: true,
      });
    }

    const member = interaction.member as GuildMember;
    const targetMember = interaction.guild.members.cache.get(user.id);

    if (!targetMember) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'User not found in this server.')],
        ephemeral: true,
      });
    }

    if (!canModerate(member, targetMember)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot mute this user.')],
        ephemeral: true,
      });
    }

    if (user.id === interaction.user.id) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot mute yourself.')],
        ephemeral: true,
      });
    }

    if (targetMember.isCommunicationDisabled()) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'This user is already muted.')],
        ephemeral: true,
      });
    }

    try {
      const durationMs = parseDuration(duration);
      const expiresAt = new Date(Date.now() + durationMs);

      await targetMember.disableCommunicationUntil(
        expiresAt,
        `${reason} | Muted by ${interaction.user.tag}`
      );

      await db.query(
        `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, duration, expires_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          interaction.guild.id,
          user.id,
          interaction.user.id,
          'mute',
          reason,
          durationMs,
          expiresAt,
        ]
      );

      const embed = createSuccessEmbed(
        'User Muted',
        `${emojis.mute} **${user.tag}** has been muted.`
      );

      embed.addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Duration', value: formatTime(durationMs), inline: true },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Expires', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true }
      );

      await interaction.reply({ embeds: [embed] });

      try {
        await user.send({
          embeds: [
            createErrorEmbed(
              'You have been muted',
              `You have been muted in **${interaction.guild.name}**\n\n**Reason:** ${reason}\n**Duration:** ${formatTime(durationMs)}`
            ),
          ],
        });
      } catch (error) {
        console.log('Could not send DM to muted user');
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
      console.error('Error muting user:', error);
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'Failed to mute the user. Please try again.')],
        ephemeral: true,
      });
    }
  }