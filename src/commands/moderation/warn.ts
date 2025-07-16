import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, canModerate } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn a user in the server')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('The user to warn')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('The reason for the warning')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction: any) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

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
        embeds: [createErrorEmbed('Error', 'You cannot warn this user.')],
        ephemeral: true,
      });
    }

    if (user.id === interaction.user.id) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'You cannot warn yourself.')],
        ephemeral: true,
      });
    }

    try {
      await db.query(
        `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason) 
         VALUES ($1, $2, $3, $4, $5)`,
        [interaction.guild.id, user.id, interaction.user.id, 'warn', reason]
      );

      await db.query(
        `UPDATE user_profiles SET warnings = warnings + 1 WHERE user_id = $1 AND guild_id = $2`,
        [user.id, interaction.guild.id]
      );

      const warningCount = await db.query(
        `SELECT warnings FROM user_profiles WHERE user_id = $1 AND guild_id = $2`,
        [user.id, interaction.guild.id]
      );

      const currentWarnings = warningCount.rows[0]?.warnings || 1;

      const embed = createSuccessEmbed(
        'User Warned',
        `${emojis.warn} **${user.tag}** has been warned.`
      );

      embed.addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Warning Count', value: `${currentWarnings}`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      );

      await interaction.reply({ embeds: [embed] });

      try {
        await user.send({
          embeds: [
            createErrorEmbed(
              'You have been warned',
              `You have been warned in **${interaction.guild.name}**\n\n**Reason:** ${reason}\n**Warning Count:** ${currentWarnings}`
            ),
          ],
        });
      } catch (error) {
        console.log('Could not send DM to warned user');
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
      console.error('Error warning user:', error);
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'Failed to warn the user. Please try again.')],
        ephemeral: true,
      });
    }
  }