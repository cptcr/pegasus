import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, TextChannel, ChannelType, PermissionsBitField } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, hasPermission, parseDuration, formatTime } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('lockdown')
  .setDescription('Lock or unlock channels to prevent message sending')
  .addSubcommand(subcommand =>
    subcommand
      .setName('channel')
      .setDescription('Lock/unlock a specific channel')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Channel to lock/unlock')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option.setName('lock')
          .setDescription('True to lock, false to unlock')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('duration')
          .setDescription('Duration for the lockdown (e.g., 1h, 30m)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the lockdown')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('server')
      .setDescription('Lock/unlock all text channels in the server')
      .addBooleanOption(option =>
        option.setName('lock')
          .setDescription('True to lock, false to unlock')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('duration')
          .setDescription('Duration for the lockdown (e.g., 1h, 30m)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the lockdown')
          .setRequired(false)
      )
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

  if (!hasPermission(member, PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You need the Manage Channels permission to use this command.')],
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const lock = interaction.options.getBoolean('lock', true);
  const duration = interaction.options.getString('duration');
  const reason = interaction.options.getString('reason') || (lock ? 'Channel lockdown' : 'Channel unlocked');

  let expiresAt: Date | null = null;
  if (duration && lock) {
    try {
      const durationMs = parseDuration(duration);
      expiresAt = new Date(Date.now() + durationMs);
    } catch (error) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'Invalid duration format. Use formats like: 1h, 30m, 2d')],
        ephemeral: true,
      });
    }
  }

  try {
    await interaction.deferReply();

    const everyoneRole = interaction.guild.roles.everyone;
    let channelsAffected: TextChannel[] = [];

    if (subcommand === 'channel') {
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
      
      if (!targetChannel.isTextBased() || targetChannel.isDMBased()) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Error', 'This command can only be used on text channels.')],
        });
      }

      channelsAffected = [targetChannel as TextChannel];
    } else if (subcommand === 'server') {
      // Get all text channels
      channelsAffected = interaction.guild.channels.cache
        .filter((channel: any) => 
          channel.type === ChannelType.GuildText || 
          channel.type === ChannelType.GuildAnnouncement
        )
        .map((channel: any) => channel);
    }

    let successCount = 0;
    let failedChannels: string[] = [];

    for (const channel of channelsAffected) {
      try {
        const currentPerms = channel.permissionOverwrites.cache.get(everyoneRole.id);
        
        if (lock) {
          // Lock the channel - deny SendMessages
          await channel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: false,
          }, { reason: `Lockdown by ${interaction.user.tag}: ${reason}` });

          // Store lockdown in database for tracking
          await db.query(
            `INSERT INTO channel_lockdowns (guild_id, channel_id, moderator_id, reason, expires_at) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (guild_id, channel_id) 
             DO UPDATE SET moderator_id = $3, reason = $4, expires_at = $5, created_at = NOW()`,
            [interaction.guild.id, channel.id, interaction.user.id, reason, expiresAt]
          );
        } else {
          // Unlock the channel
          if (currentPerms?.deny.has(PermissionsBitField.Flags.SendMessages)) {
            await channel.permissionOverwrites.edit(everyoneRole, {
              SendMessages: null, // Reset to default
            }, { reason: `Unlock by ${interaction.user.tag}: ${reason}` });
          }

          // Remove from lockdown tracking
          await db.query(
            'DELETE FROM channel_lockdowns WHERE guild_id = $1 AND channel_id = $2',
            [interaction.guild.id, channel.id]
          );
        }

        successCount++;
      } catch (error) {
        console.error(`Failed to ${lock ? 'lock' : 'unlock'} channel ${channel.name}:`, error);
        failedChannels.push(channel.name);
      }
    }

    // Log the action
    await db.query(
      `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        interaction.guild.id,
        null,
        interaction.user.id,
        lock ? 'lockdown' : 'unlock',
        reason,
        JSON.stringify({
          type: subcommand,
          channels_affected: successCount,
          duration: duration || null,
          expires_at: expiresAt?.toISOString() || null,
        }),
      ]
    );

    const embed = createSuccessEmbed(
      lock ? 'Lockdown Activated' : 'Lockdown Removed',
      lock 
        ? `${emojis.lock} Successfully locked **${successCount}** channel${successCount === 1 ? '' : 's'}.`
        : `${emojis.unlock} Successfully unlocked **${successCount}** channel${successCount === 1 ? '' : 's'}.`
    );

    embed.addFields(
      { name: 'Type', value: subcommand === 'server' ? 'Server-wide' : 'Single Channel', inline: true },
      { name: 'Moderator', value: `${interaction.user}`, inline: true },
      { name: 'Channels Affected', value: successCount.toString(), inline: true },
      { name: 'Reason', value: reason, inline: false }
    );

    if (duration && lock) {
      embed.addFields({ name: 'Duration', value: formatTime(parseDuration(duration)), inline: true });
    }

    if (failedChannels.length > 0) {
      embed.addFields({ 
        name: 'Failed Channels', 
        value: failedChannels.slice(0, 10).join(', ') + (failedChannels.length > 10 ? '...' : ''), 
        inline: false 
      });
    }

    await interaction.editReply({ embeds: [embed] });

    // Send to log channel if configured
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

    // Schedule unlock if duration is set
    if (duration && lock && expiresAt) {
      setTimeout(async () => {
        try {
          // Auto-unlock after duration
          for (const channel of channelsAffected) {
            try {
              await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: null,
              }, { reason: 'Automatic unlock after lockdown duration expired' });
            } catch (error) {
              console.error(`Failed to auto-unlock channel ${channel.name}:`, error);
            }
          }

          // Remove from database
          await db.query(
            'DELETE FROM channel_lockdowns WHERE guild_id = $1 AND expires_at <= NOW()',
            [interaction.guild.id]
          );

          // Send notification
          const unlockEmbed = createSuccessEmbed(
            'Automatic Unlock',
            `${emojis.unlock} Lockdown has automatically expired and channels have been unlocked.`
          );

          if (settings.rows[0]?.log_channel) {
            const logChannel = interaction.guild.channels.cache.get(settings.rows[0].log_channel);
            if (logChannel?.isTextBased()) {
              await logChannel.send({ embeds: [unlockEmbed] });
            }
          }
        } catch (error) {
          console.error('Error in automatic unlock:', error);
        }
      }, parseDuration(duration));
    }

  } catch (error) {
    console.error('Error managing lockdown:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to manage lockdown. Please check my permissions and try again.')],
    });
  }
}