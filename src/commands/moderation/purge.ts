import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, TextChannel, Message } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, hasPermission } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Bulk delete messages with various filters')
  .addIntegerOption(option =>
    option.setName('amount')
      .setDescription('Number of messages to delete (1-100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .addUserOption(option =>
    option.setName('user')
      .setDescription('Only delete messages from this user')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('bots')
      .setDescription('Only delete messages from bots')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('contains')
      .setDescription('Only delete messages containing this text')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('attachments')
      .setDescription('Only delete messages with attachments')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('embeds')
      .setDescription('Only delete messages with embeds')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for the purge')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);

export async function execute(interaction: any) {
  const amount = interaction.options.getInteger('amount', true);
  const targetUser = interaction.options.getUser('user');
  const botsOnly = interaction.options.getBoolean('bots');
  const contains = interaction.options.getString('contains');
  const attachmentsOnly = interaction.options.getBoolean('attachments');
  const embedsOnly = interaction.options.getBoolean('embeds');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  const member = interaction.member as GuildMember;
  const channel = interaction.channel as TextChannel;

  if (!hasPermission(member, PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'You need the Manage Messages permission to use this command.')],
      ephemeral: true,
    });
  }

  if (!channel.isTextBased() || channel.isDMBased()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in text channels.')],
      ephemeral: true,
    });
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    // Fetch messages to delete
    const messages = await channel.messages.fetch({ limit: Math.min(amount + 50, 100) });
    let messagesToDelete: Message[] = [];

    for (const message of messages.values()) {
      if (messagesToDelete.length >= amount) break;
      
      // Skip messages older than 14 days (Discord limitation)
      if (Date.now() - message.createdTimestamp > 14 * 24 * 60 * 60 * 1000) continue;

      // Apply filters
      if (targetUser && message.author.id !== targetUser.id) continue;
      if (botsOnly && !message.author.bot) continue;
      if (contains && !message.content.toLowerCase().includes(contains.toLowerCase())) continue;
      if (attachmentsOnly && message.attachments.size === 0) continue;
      if (embedsOnly && message.embeds.length === 0) continue;

      messagesToDelete.push(message);
    }

    if (messagesToDelete.length === 0) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Error', 'No messages match the specified criteria or all messages are older than 14 days.')],
      });
    }

    // Delete messages in batches
    const deleted: Message[] = [];
    const chunks = [];
    for (let i = 0; i < messagesToDelete.length; i += 100) {
      chunks.push(messagesToDelete.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      if (chunk.length === 1) {
        await chunk[0].delete();
        deleted.push(chunk[0]);
      } else {
        const deletedChunk = await channel.bulkDelete(chunk, true);
        deleted.push(...deletedChunk.values());
      }
    }

    // Log the action
    await db.query(
      `INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, channel_id, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        interaction.guild.id,
        targetUser?.id || null,
        interaction.user.id,
        'purge',
        reason,
        channel.id,
        JSON.stringify({
          amount: deleted.length,
          filters: {
            user: targetUser?.id || null,
            bots: botsOnly,
            contains,
            attachments: attachmentsOnly,
            embeds: embedsOnly,
          },
        }),
      ]
    );

    const embed = createSuccessEmbed(
      'Messages Purged',
      `${emojis.delete} Successfully deleted **${deleted.length}** message${deleted.length === 1 ? '' : 's'}.`
    );

    embed.addFields(
      { name: 'Channel', value: `${channel}`, inline: true },
      { name: 'Moderator', value: `${interaction.user}`, inline: true },
      { name: 'Reason', value: reason, inline: false }
    );

    if (targetUser) {
      embed.addFields({ name: 'Target User', value: `${targetUser}`, inline: true });
    }

    const filters = [];
    if (botsOnly) filters.push('Bots only');
    if (contains) filters.push(`Contains: "${contains}"`);
    if (attachmentsOnly) filters.push('With attachments');
    if (embedsOnly) filters.push('With embeds');

    if (filters.length > 0) {
      embed.addFields({ name: 'Filters Applied', value: filters.join(', '), inline: false });
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

  } catch (error) {
    console.error('Error purging messages:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to purge messages. Please check my permissions and try again.')],
    });
  }
}