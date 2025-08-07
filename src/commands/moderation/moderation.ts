import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { auditLogger } from '../../security/audit';
import { getDatabase } from '../../database/connection';
import { userXp } from '../../database/schema/xp';
import { eq, and } from 'drizzle-orm';

export const data = new SlashCommandBuilder()
  .setName('moderation')
  .setDescription(t('commands.moderation.description'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(subcommand =>
    subcommand
      .setName('ban')
      .setDescription(t('commands.moderation.subcommands.ban.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.moderation.subcommands.ban.options.user'))
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.moderation.subcommands.ban.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
      .addIntegerOption(option =>
        option
          .setName('delete_days')
          .setDescription(t('commands.moderation.subcommands.ban.options.deleteDays'))
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(7)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('kick')
      .setDescription(t('commands.moderation.subcommands.kick.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.moderation.subcommands.kick.options.user'))
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.moderation.subcommands.kick.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('timeout')
      .setDescription(t('commands.moderation.subcommands.timeout.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.moderation.subcommands.timeout.options.user'))
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('duration')
          .setDescription(t('commands.moderation.subcommands.timeout.options.duration'))
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(40320) // 28 days in minutes
          .addChoices(
            { name: '60 seconds', value: 1 },
            { name: '5 minutes', value: 5 },
            { name: '10 minutes', value: 10 },
            { name: '30 minutes', value: 30 },
            { name: '1 hour', value: 60 },
            { name: '6 hours', value: 360 },
            { name: '12 hours', value: 720 },
            { name: '1 day', value: 1440 },
            { name: '3 days', value: 4320 },
            { name: '1 week', value: 10080 },
            { name: '2 weeks', value: 20160 },
            { name: '4 weeks', value: 40320 }
          )
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.moderation.subcommands.timeout.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reset-xp')
      .setDescription(t('commands.moderation.subcommands.resetxp.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.moderation.subcommands.resetxp.options.user'))
          .setRequired(true)
      )
      .addBooleanOption(option =>
        option
          .setName('confirm')
          .setDescription(t('commands.moderation.subcommands.resetxp.options.confirm'))
          .setRequired(true)
      )
  );

export const category = CommandCategory.Moderation;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ModerateMembers];

export async function execute(interaction: ChatInputCommandInteraction): Promise<any> {
  if (!interaction.guild) {
    return interaction.reply({
      content: t('common.guildOnly'),
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'ban':
      return handleBan(interaction);
    case 'kick':
      return handleKick(interaction);
    case 'timeout':
      return handleTimeout(interaction);
    case 'reset-xp':
      return handleResetXP(interaction);
    default:
      return interaction.reply({
        content: t('common.unknownSubcommand'),
        ephemeral: true,
      });
  }
}

async function handleBan(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');
  const deleteDays = interaction.options.getInteger('delete_days') || 0;

  // Get member
  const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
  
  if (!member) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.ban.memberNotFound'),
    });
  }

  // Check if user is trying to ban themselves
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.ban.cannotBanSelf'),
    });
  }

  // Check if user is trying to ban the bot
  if (user.id === interaction.client.user!.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.ban.cannotBanBot'),
    });
  }

  // Check permissions and hierarchy
  const executorMember = interaction.member as GuildMember;
  const botMember = interaction.guild!.members.me!;

  if (!member.bannable) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.ban.cannotBan'),
    });
  }

  if (member.roles.highest.position >= executorMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.ban.higherRole'),
    });
  }

  if (member.roles.highest.position >= botMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.ban.botHierarchy'),
    });
  }

  try {
    // Try to DM the user before banning
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(t('commands.moderation.subcommands.ban.dmTitle'))
        .setDescription(t('commands.moderation.subcommands.ban.dmDescription', {
          guild: interaction.guild!.name,
          reason: reason,
        }))
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // User has DMs disabled
    }

    // Ban the user
    await member.ban({
      reason: `${reason} | Banned by ${interaction.user.tag}`,
      deleteMessageSeconds: deleteDays * 24 * 60 * 60,
    });

    // Log the action
    await auditLogger.logAction({
      action: 'MEMBER_BAN',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: user.id,
      details: {
        reason,
        deleteDays,
      },
    });

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle(t('commands.moderation.subcommands.ban.success.title'))
      .setDescription(t('commands.moderation.subcommands.ban.success.description', {
        user: user.tag,
        moderator: interaction.user.tag,
      }))
      .addFields(
        {
          name: t('commands.moderation.subcommands.ban.success.reason'),
          value: reason,
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error banning member:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.ban.error'),
    });
  }
}

async function handleKick(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');

  // Get member
  const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
  
  if (!member) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.kick.memberNotFound'),
    });
  }

  // Check if user is trying to kick themselves
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.kick.cannotKickSelf'),
    });
  }

  // Check if user is trying to kick the bot
  if (user.id === interaction.client.user!.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.kick.cannotKickBot'),
    });
  }

  // Check permissions and hierarchy
  const executorMember = interaction.member as GuildMember;
  const botMember = interaction.guild!.members.me!;

  if (!member.kickable) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.kick.cannotKick'),
    });
  }

  if (member.roles.highest.position >= executorMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.kick.higherRole'),
    });
  }

  if (member.roles.highest.position >= botMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.kick.botHierarchy'),
    });
  }

  try {
    // Try to DM the user before kicking
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle(t('commands.moderation.subcommands.kick.dmTitle'))
        .setDescription(t('commands.moderation.subcommands.kick.dmDescription', {
          guild: interaction.guild!.name,
          reason: reason,
        }))
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // User has DMs disabled
    }

    // Kick the user
    await member.kick(`${reason} | Kicked by ${interaction.user.tag}`);

    // Log the action
    await auditLogger.logAction({
      action: 'MEMBER_KICK',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: user.id,
      details: {
        reason,
      },
    });

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle(t('commands.moderation.subcommands.kick.success.title'))
      .setDescription(t('commands.moderation.subcommands.kick.success.description', {
        user: user.tag,
        moderator: interaction.user.tag,
      }))
      .addFields(
        {
          name: t('commands.moderation.subcommands.kick.success.reason'),
          value: reason,
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error kicking member:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.kick.error'),
    });
  }
}

async function handleTimeout(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const duration = interaction.options.getInteger('duration', true);
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');

  // Get member
  const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
  
  if (!member) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.memberNotFound'),
    });
  }

  // Check if user is trying to timeout themselves
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.cannotTimeoutSelf'),
    });
  }

  // Check if user is trying to timeout the bot
  if (user.id === interaction.client.user!.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.cannotTimeoutBot'),
    });
  }

  // Check permissions and hierarchy
  const executorMember = interaction.member as GuildMember;
  const botMember = interaction.guild!.members.me!;

  if (!member.moderatable) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.cannotTimeout'),
    });
  }

  if (member.roles.highest.position >= executorMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.higherRole'),
    });
  }

  if (member.roles.highest.position >= botMember.roles.highest.position) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.botHierarchy'),
    });
  }

  try {
    // Calculate timeout duration in milliseconds
    const timeoutDuration = duration * 60 * 1000;
    
    // Timeout the user
    await member.timeout(timeoutDuration, `${reason} | Timed out by ${interaction.user.tag}`);

    // Try to DM the user
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle(t('commands.moderation.subcommands.timeout.dmTitle'))
        .setDescription(t('commands.moderation.subcommands.timeout.dmDescription', {
          guild: interaction.guild!.name,
          duration: formatDuration(duration),
          reason: reason,
        }))
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // User has DMs disabled
    }

    // Log the action
    await auditLogger.logAction({
      action: 'MEMBER_TIMEOUT',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: user.id,
      details: {
        duration,
        reason,
      },
    });

    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle(t('commands.moderation.subcommands.timeout.success.title'))
      .setDescription(t('commands.moderation.subcommands.timeout.success.description', {
        user: user.tag,
        duration: formatDuration(duration),
        moderator: interaction.user.tag,
      }))
      .addFields(
        {
          name: t('commands.moderation.subcommands.timeout.success.reason'),
          value: reason,
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error timing out member:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.timeout.error'),
    });
  }
}

async function handleResetXP(interaction: ChatInputCommandInteraction): Promise<any> {
  const db = getDatabase();
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const confirm = interaction.options.getBoolean('confirm', true);

  if (!confirm) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.resetxp.notConfirmed'),
    });
  }

  // Check if user is trying to reset their own XP
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      content: t('commands.moderation.subcommands.resetxp.cannotResetSelf'),
    });
  }

  try {
    // Reset user's XP
    await db.update(userXp)
      .set({
        xp: 0,
        level: 0,
        lastXpGain: new Date(),
      })
      .where(
        and(
          eq(userXp.userId, user.id),
          eq(userXp.guildId, interaction.guild!.id)
        )
      );

    // Log the action
    await auditLogger.logAction({
      action: 'XP_RESET',
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      targetId: user.id,
      details: {},
    });

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(t('commands.moderation.subcommands.resetxp.success.title'))
      .setDescription(t('commands.moderation.subcommands.resetxp.success.description', {
        user: user.tag,
        moderator: interaction.user.tag,
      }))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error resetting XP:', error);
    await interaction.editReply({
      content: t('commands.moderation.subcommands.resetxp.error'),
    });
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours < 24) {
    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  if (remainingHours === 0) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
}