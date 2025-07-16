import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, canModerate } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a user from the server')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('The user to kick')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('The reason for the kick')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
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
        embeds: [createErrorEmbed('Error', 'You cannot kick this user.')],
        ephemeral: true,
      });
    }

    if (user.id === interaction.user.id) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot kick yourself.')],
        ephemeral: true,
      });
    }

    try {
      await targetMember.kick(`${reason} | Kicked by ${interaction.user.tag}`);

      await db.query(
        `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason) 
         VALUES ($1, $2, $3, $4, $5)`,
        [interaction.guild.id, user.id, interaction.user.id, 'kick', reason]
      );

      const embed = createSuccessEmbed(
        'User Kicked',
        `${emojis.kick} **${user.tag}** has been kicked from the server.`
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
            createErrorEmbed(
              'You have been kicked',
              `You have been kicked from **${interaction.guild.name}**\n\n**Reason:** ${reason}`
            ),
          ],
        });
      } catch (error) {
        console.log('Could not send DM to kicked user');
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
      console.error('Error kicking user:', error);
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'Failed to kick the user. Please try again.')],
        ephemeral: true,
      });
    }
  }