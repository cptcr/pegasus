// src/commands/moderation/clear.ts - Fixed Message Clear/Purge Moderation Command
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  EmbedBuilder,
  TextChannel,
  Message,
  GuildMember
} from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: 'clear',
  description: 'Clear messages from the current channel',
  category: 'moderation',
  usage: '/clear <amount> [user] [reason]',
  examples: [
    '/clear 10',
    '/clear 50 user:@spammer',
    '/clear 25 reason:"Clean up spam"'
  ],
  permissions: ['MANAGE_MESSAGES'],
  cooldown: 5,
  guildOnly: true,
  aliases: ['purge', 'delete', 'prune']
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear messages from the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for clearing messages')
        .setMaxLength(500)
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('bots')
        .setDescription('Only delete bot messages')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('attachments')
        .setDescription('Only delete messages with attachments')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('embeds')
        .setDescription('Only delete messages with embeds')
        .setRequired(false)),
  category: 'moderation',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const amount = interaction.options.getInteger('amount', true);
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const botsOnly = interaction.options.getBoolean('bots') || false;
    const attachmentsOnly = interaction.options.getBoolean('attachments') || false;
    const embedsOnly = interaction.options.getBoolean('embeds') || false;

    const channel = interaction.channel as TextChannel;
    if (!channel.isTextBased()) {
      await interaction.reply({
        content: '❌ This command can only be used in text channels.',
        ephemeral: true
      });
      return;
    }

    // Check bot permissions
    if (!channel.permissionsFor(interaction.guild.members.me!)?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        content: '❌ I don\'t have permission to manage messages in this channel.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Fetch messages
      const messages = await channel.messages.fetch({ limit: Math.min(amount + 50, 100) });
      
      // Filter messages based on criteria
      let messagesToDelete = Array.from(messages.values());

      // Filter by user
      if (targetUser) {
        messagesToDelete = messagesToDelete.filter(msg => msg.author.id === targetUser.id);
      }

      // Filter by bots
      if (botsOnly) {
        messagesToDelete = messagesToDelete.filter(msg => msg.author.bot);
      }

      // Filter by attachments
      if (attachmentsOnly) {
        messagesToDelete = messagesToDelete.filter(msg => msg.attachments.size > 0);
      }

      // Filter by embeds
      if (embedsOnly) {
        messagesToDelete = messagesToDelete.filter(msg => msg.embeds.length > 0);
      }

      // Filter out messages older than 14 days (Discord API limitation)
      const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
      messagesToDelete = messagesToDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);

      // Limit to requested amount
      messagesToDelete = messagesToDelete.slice(0, amount);

      if (messagesToDelete.length === 0) {
        await interaction.editReply({
          content: '❌ No messages found matching the specified criteria that can be deleted.'
        });
        return;
      }

      // Store message info for logging before deletion
      const messageInfo = messagesToDelete.map(msg => ({
        id: msg.id,
        author: msg.author.tag,
        authorId: msg.author.id,
        content: msg.content.substring(0, 100),
        createdAt: msg.createdAt.toISOString(),
        attachments: msg.attachments.size,
        embeds: msg.embeds.length
      }));

      // Delete messages
      let deletedCount = 0;
      
      if (messagesToDelete.length === 1) {
        // Delete single message
        await messagesToDelete[0].delete();
        deletedCount = 1;
      } else {
        // Bulk delete messages
        const bulkDeleted = await channel.bulkDelete(messagesToDelete, true);
        deletedCount = bulkDeleted.size;
      }

      // Log the action
      await client.db.log.create({
        data: {
          guildId: interaction.guild.id,
          type: 'MESSAGE_CLEAR',
          content: JSON.stringify({
            moderatorId: interaction.user.id,
            moderatorTag: interaction.user.tag,
            channelId: channel.id,
            channelName: channel.name,
            deletedCount: deletedCount,
            requestedAmount: amount,
            targetUserId: targetUser?.id,
            targetUserTag: targetUser?.tag,
            reason: reason,
            filters: {
              bots: botsOnly,
              attachments: attachmentsOnly,
              embeds: embedsOnly
            },
            messages: messageInfo
          })
        }
      });

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.SUCCESS} Messages Cleared`)
        .setDescription(`Successfully deleted **${deletedCount}** message${deletedCount > 1 ? 's' : ''} from ${channel}.`)
        .addFields(
          { name: 'Moderator', value: `${interaction.user}`, inline: true },
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setColor(Config.COLORS.SUCCESS)
        .setTimestamp();

      if (targetUser) {
        embed.addFields({ name: 'Target User', value: `${targetUser}`, inline: true });
      }

      const filters = [];
      if (botsOnly) filters.push('Bots only');
      if (attachmentsOnly) filters.push('Attachments only');
      if (embedsOnly) filters.push('Embeds only');
      
      if (filters.length > 0) {
        embed.addFields({ name: 'Filters', value: filters.join(', '), inline: true });
      }

      await interaction.editReply({ embeds: [embed] });

      // Send a temporary confirmation message in the channel
      const confirmMessage = await channel.send({
        content: `🗑️ **${deletedCount}** message${deletedCount > 1 ? 's' : ''} deleted by ${interaction.user} ${targetUser ? `from ${targetUser}` : ''}`
      });

      // Delete the confirmation message after 5 seconds
      setTimeout(async () => {
        try {
          await confirmMessage.delete();
        } catch (error) {
          // Message might already be deleted
        }
      }, 5000);

      // Emit to dashboard
      client.wsManager.emitRealtimeEvent(interaction.guild.id, 'moderation:messages_cleared', {
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        channelId: channel.id,
        channelName: channel.name,
        deletedCount: deletedCount,
        targetUserId: targetUser?.id,
        reason: reason
      });

      client.logger.info(`${interaction.user.tag} cleared ${deletedCount} messages in #${channel.name} (${interaction.guild.name})`);

    } catch (error) {
      client.logger.error('Error clearing messages:', error);
      
      let errorMessage = 'An error occurred while clearing messages.';
      
      if (error instanceof Error) {
        if (error.message.includes('Missing Permissions')) {
          errorMessage = 'I don\'t have sufficient permissions to delete messages.';
        } else if (error.message.includes('Unknown Message')) {
          errorMessage = 'Some messages could not be found or were already deleted.';
        } else if (error.message.includes('You can only bulk delete messages')) {
          errorMessage = 'Messages older than 14 days cannot be bulk deleted. Try with fewer messages or delete individually.';
        }
      }
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `❌ ${errorMessage}`,
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: `❌ ${errorMessage}`
        });
      }
    }
  }
};
export default command;