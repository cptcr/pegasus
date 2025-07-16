import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, canModerate } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a user in the server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to unmute')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for the unmute')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false);

export async function execute(interaction: any) {
    const user = interaction.options.getUser('user', true);
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
        embeds: [createErrorEmbed('Error', 'You cannot unmute this user.')],
        ephemeral: true,
      });
    }

    if (!targetMember.isCommunicationDisabled()) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'This user is not muted.')],
        ephemeral: true,
      });
    }

    try {
      await targetMember.disableCommunicationUntil(
        null,
        `${reason} | Unmuted by ${interaction.user.tag}`
      );

      await db.query(
        `UPDATE mod_actions SET active = false WHERE guild_id = $1 AND user_id = $2 AND action = 'mute' AND active = true`,
        [interaction.guild.id, user.id]
      );

      await db.query(
        `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason) 
         VALUES ($1, $2, $3, $4, $5)`,
        [interaction.guild.id, user.id, interaction.user.id, 'unmute', reason]
      );

      const embed = createSuccessEmbed(
        'User Unmuted',
        `${emojis.unmute} **${user.tag}** has been unmuted.`
      );

      embed.addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      );

      await interaction.reply({ embeds: [embed] });

      try {
        await user.send({
          embeds: [
            createSuccessEmbed(
              'You have been unmuted',
              `You have been unmuted in **${interaction.guild.name}**\n\n**Reason:** ${reason}`
            ),
          ],
        });
      } catch (error) {
        console.log('Could not send DM to unmuted user');
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
      console.error('Error unmuting user:', error);
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'Failed to unmute the user. Please try again.')],
        ephemeral: true,
      });
    }
  }