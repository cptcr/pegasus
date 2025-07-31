import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, TextChannel } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, hasPermission, formatTime } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Manage channel slowmode settings')
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Set slowmode for the current channel')
      .addIntegerOption(option =>
        option.setName('seconds')
          .setDescription('Slowmode duration in seconds (0-21600, 0 to disable)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(21600) // 6 hours max
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for setting slowmode')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('disable')
      .setDescription('Disable slowmode for the current channel')
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for disabling slowmode')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Check current slowmode status')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  const member = interaction.member as GuildMember;
  const channel = interaction.channel as TextChannel;

  if (!hasPermission(member, PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You need the Manage Channels permission to use this command.')],
      ephemeral: true,
    });
  }

  if (!channel.isTextBased() || channel.isDMBased()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in text channels.')],
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'set': {
        const seconds = interaction.options.getInteger('seconds', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';

        await channel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}: ${reason}`);

        // Log the action
        await db.query(
          `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, channel_id, metadata) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            interaction.guild.id,
            null,
            interaction.user.id,
            'slowmode_set',
            reason,
            channel.id,
            JSON.stringify({ seconds }),
          ]
        );

        const embed = createSuccessEmbed(
          'Slowmode Updated',
          seconds === 0
            ? `${emojis.success} Slowmode has been **disabled** for ${channel}.`
            : `${emojis.slowmode} Slowmode has been set to **${formatTime(seconds * 1000)}** for ${channel}.`
        );

        embed.addFields(
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Moderator', value: `${interaction.user}`, inline: true },
          { name: 'Duration', value: seconds === 0 ? 'Disabled' : formatTime(seconds * 1000), inline: true },
          { name: 'Reason', value: reason, inline: false }
        );

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'disable': {
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (channel.rateLimitPerUser === 0) {
          return interaction.reply({
            embeds: [createErrorEmbed('Error', 'Slowmode is already disabled for this channel.')],
            ephemeral: true,
          });
        }

        await channel.setRateLimitPerUser(0, `Slowmode disabled by ${interaction.user.tag}: ${reason}`);

        // Log the action
        await db.query(
          `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, channel_id) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            interaction.guild.id,
            null,
            interaction.user.id,
            'slowmode_disable',
            reason,
            channel.id,
          ]
        );

        const embed = createSuccessEmbed(
          'Slowmode Disabled',
          `${emojis.success} Slowmode has been **disabled** for ${channel}.`
        );

        embed.addFields(
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Moderator', value: `${interaction.user}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        );

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'status': {
        const currentSlowmode = channel.rateLimitPerUser;
        
        const embed = createSuccessEmbed(
          'Slowmode Status',
          currentSlowmode === 0
            ? `${emojis.info} Slowmode is currently **disabled** for ${channel}.`
            : `${emojis.slowmode} Current slowmode for ${channel} is **${formatTime(currentSlowmode * 1000)}**.`
        );

        embed.addFields(
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Current Setting', value: currentSlowmode === 0 ? 'Disabled' : formatTime(currentSlowmode * 1000), inline: true }
        );

        await interaction.reply({ embeds: [embed] });
        break;
      }
    }

    // Send to log channel if configured (except for status checks)
    if (subcommand !== 'status') {
      const settings = await db.query(
        'SELECT log_channel FROM guild_settings WHERE guild_id = $1',
        [interaction.guild.id]
      );

      if (settings.rows[0]?.log_channel) {
        const logChannel = interaction.guild.channels.cache.get(settings.rows[0].log_channel);
        if (logChannel?.isTextBased()) {
          const logEmbed = createSuccessEmbed(
            'Slowmode Action',
            `Slowmode ${subcommand} action performed in ${channel}`
          );
          logEmbed.addFields(
            { name: 'Moderator', value: `${interaction.user}`, inline: true },
            { name: 'Action', value: subcommand, inline: true }
          );
          await logChannel.send({ embeds: [logEmbed] });
        }
      }
    }

  } catch (error) {
    console.error('Error managing slowmode:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to manage slowmode. Please check my permissions and try again.')],
      ephemeral: true,
    });
  }
}