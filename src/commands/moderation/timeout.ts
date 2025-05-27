
// src/commands/moderation/timeout.ts - Timeout/Mute Command
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  EmbedBuilder,
  GuildMember
} from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: 'timeout',
  description: 'Timeout a user (prevents them from sending messages)',
  category: 'moderation',
  usage: '/timeout <user> <duration> [reason]',
  examples: [
    '/timeout @user 10m Spamming',
    '/timeout @user 1h Inappropriate behavior',
    '/timeout @user 1d Breaking rules'
  ],
  permissions: ['MODERATE_MEMBERS'],
  cooldown: 3,
  guildOnly: true
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user (prevents them from sending messages)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a timeout to a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to timeout')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('duration')
            .setDescription('Duration (e.g., 10m, 1h, 2d)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for the timeout')
            .setMaxLength(500))
        .addBooleanOption(option =>
          option.setName('silent')
            .setDescription('Don\'t send a DM to the user')))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove timeout from a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to remove timeout from')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for removing timeout'))),
  category: 'moderation',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        await handleAddTimeout(interaction, client);
        break;
      case 'remove':
        await handleRemoveTimeout(interaction, client);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand.',
          ephemeral: true
        });
    }
  }
};

async function handleAddTimeout(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  const target = interaction.options.getUser('user', true);
  const durationStr = interaction.options.getString('duration', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const silent = interaction.options.getBoolean('silent') || false;

  try {
    // Parse duration
    const duration = parseDuration(durationStr);
    if (!duration) {
      return interaction.reply({
        content: '❌ Invalid duration format. Use formats like: 10m, 1h, 2d (max 28 days)',
        ephemeral: true
      });
    }

    if (duration > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        content: '❌ Timeout duration cannot exceed 28 days.',
        ephemeral: true
      });
    }

    // Get the member object
    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
    
    if (!member) {
      return interaction.reply({
        content: '❌ User not found in this server.',
        ephemeral: true
      });
    }

    // Check hierarchy
    const moderator = interaction.member as GuildMember;
    if (member.roles.highest.position >= moderator.roles.highest.position && 
        interaction.guild!.ownerId !== moderator.id) {
      return interaction.reply({
        content: '❌ You cannot timeout this user due to role hierarchy.',
        ephemeral: true
      });
    }

    // Check if target is server owner
    if (member.id === interaction.guild!.ownerId) {
      return interaction.reply({
        content: '❌ You cannot timeout the server owner.',
        ephemeral: true
      });
    }

    // Check if user is already timed out
    if (member.communicationDisabledUntil && member.communicationDisabledUntil > new Date()) {
      return interaction.reply({
        content: `❌ ${target.tag} is already timed out until <t:${Math.floor(member.communicationDisabledUntil.getTime() / 1000)}:F>.`,
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const endTime = new Date(Date.now() + duration);

    // Send DM to user before timeout (if not silent)
    if (!silent) {
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🔇 You have been timed out')
          .setDescription(`You have been timed out in **${interaction.guild!.name}**.`)
          .addFields(
            { name: 'Reason', value: reason, inline: true },
            { name: 'Duration', value: formatDuration(duration), inline: true },
            { name: 'Expires', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true }
          )
          .setColor(Config.COLORS.WARNING)
          .setTimestamp();

        if (interaction.guild!.iconURL()) {
          dmEmbed.setThumbnail(interaction.guild!.iconURL());
        }

        await target.send({ embeds: [dmEmbed] });
      } catch (error) {
        client.logger.warn(`Could not send timeout DM to ${target.tag}:`, error);
      }
    }

    // Execute the timeout
    await member.timeout(duration, `${reason} | Moderator: ${interaction.user.tag}`);

    // Create timeout log entry
    await client.db.log.create({
      data: {
        guildId: interaction.guild!.id,
        type: 'TIMEOUT',
        content: JSON.stringify({
          targetId: target.id,
          targetTag: target.tag,
          moderatorId: interaction.user.id,
          moderatorTag: interaction.user.tag,
          reason: reason,
          duration: duration,
          endTime: endTime.toISOString(),
          silent: silent
        }),
        userId: target.id
      }
    });

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setTitle(`${Config.EMOJIS.SUCCESS} User Timed Out`)
      .setDescription(`Successfully timed out **${target.tag}**.`)
      .addFields(
        { name: 'User', value: `${target} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user}`, inline: true },
        { name: 'Duration', value: formatDuration(duration), inline: true },
        { name: 'Expires', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setColor(Config.COLORS.WARNING)
      .setTimestamp();

    if (silent) {
      successEmbed.addFields({
        name: 'Silent Timeout',
        value: 'User was not notified',
        inline: true
      });
    }

    await interaction.editReply({ embeds: [successEmbed] });

    // Emit to dashboard
    client.wsManager.emitRealtimeEvent(interaction.guild!.id, 'member:timeout', {
      targetId: target.id,
      targetTag: target.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason: reason,
      duration: duration,
      endTime: endTime.toISOString()
    });

    client.logger.info(`${target.tag} (${target.id}) was timed out in ${interaction.guild!.name} by ${interaction.user.tag} for ${formatDuration(duration)}`);

  } catch (error) {
    client.logger.error('Error executing timeout command:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `❌ Failed to timeout user: ${errorMessage}`,
        ephemeral: true
      });
    } else {
      await interaction.editReply({
        content: `❌ Failed to timeout user: ${errorMessage}`
      });
    }
  }
}

async function handleRemoveTimeout(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  try {
    // Get the member object
    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
    
    if (!member) {
      return interaction.reply({
        content: '❌ User not found in this server.',
        ephemeral: true
      });
    }

    // Check if user is actually timed out
    if (!member.communicationDisabledUntil || member.communicationDisabledUntil <= new Date()) {
      return interaction.reply({
        content: `❌ ${target.tag} is not currently timed out.`,
        ephemeral: true
      });
    }

    await interaction.deferReply();

    // Remove the timeout
    await member.timeout(null, `Timeout removed: ${reason} | Moderator: ${interaction.user.tag}`);

    // Create log entry
    await client.db.log.create({
      data: {
        guildId: interaction.guild!.id,
        type: 'TIMEOUT_REMOVE',
        content: JSON.stringify({
          targetId: target.id,
          targetTag: target.tag,
          moderatorId: interaction.user.id,
          moderatorTag: interaction.user.tag,
          reason: reason
        }),
        userId: target.id
      }
    });

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setTitle(`${Config.EMOJIS.SUCCESS} Timeout Removed`)
      .setDescription(`Successfully removed timeout from **${target.tag}**.`)
      .addFields(
        { name: 'User', value: `${target} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user}`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setColor(Config.COLORS.SUCCESS)
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

    // Emit to dashboard
    client.wsManager.emitRealtimeEvent(interaction.guild!.id, 'member:timeout_removed', {
      targetId: target.id,
      targetTag: target.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason: reason
    });

    client.logger.info(`Timeout removed from ${target.tag} (${target.id}) in ${interaction.guild!.name} by ${interaction.user.tag}`);

  } catch (error) {
    client.logger.error('Error removing timeout:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `❌ Failed to remove timeout: ${errorMessage}`,
        ephemeral: true
      });
    } else {
      await interaction.editReply({
        content: `❌ Failed to remove timeout: ${errorMessage}`
      });
    }
  }
}

function parseDuration(duration: string): number | null {
  const regex = /^(\d+)([smhd])$/i;
  const match = duration.match(regex);
  
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  if (seconds > 0 && parts.length === 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);
  
  return parts.join(', ') || '0 seconds';
}

export default command;