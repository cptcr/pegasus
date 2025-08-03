import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { db } from '../../database/drizzle';
import { blacklist } from '../../database/schema';
import { eq, and, desc } from 'drizzle-orm';

export const data = new SlashCommandBuilder()
  .setName('blacklist')
  .setDescription(t('commands.blacklist.description'))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('user')
      .setDescription(t('commands.blacklist.subcommands.user.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.blacklist.subcommands.user.options.user'))
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription(t('commands.blacklist.subcommands.user.options.reason'))
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription(t('commands.blacklist.subcommands.view.description'))
      .addIntegerOption(option =>
        option
          .setName('page')
          .setDescription(t('commands.blacklist.subcommands.view.options.page'))
          .setRequired(false)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription(t('commands.blacklist.subcommands.remove.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.blacklist.subcommands.remove.options.user'))
          .setRequired(true)
      )
  );

export const category = CommandCategory.Admin;
export const cooldown = 5;
export const permissions = [PermissionFlagsBits.Administrator];

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: t('common.guildOnly'),
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'user':
      return handleBlacklistUser(interaction);
    case 'view':
      return handleBlacklistView(interaction);
    case 'remove':
      return handleBlacklistRemove(interaction);
  }
}

async function handleBlacklistUser(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || t('common.noReasonProvided');

  // Check if user is already blacklisted
  const [existing] = await db
    .select()
    .from(blacklist)
    .where(
      and(
        eq(blacklist.userId, user.id),
        eq(blacklist.guildId, interaction.guild!.id)
      )
    )
    .limit(1);

  if (existing) {
    return interaction.editReply({
      content: t('commands.blacklist.subcommands.user.alreadyBlacklisted'),
    });
  }

  // Check if user is trying to blacklist themselves
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      content: t('commands.blacklist.subcommands.user.cannotBlacklistSelf'),
    });
  }

  // Check if user is trying to blacklist the bot
  if (user.id === interaction.client.user!.id) {
    return interaction.editReply({
      content: t('commands.blacklist.subcommands.user.cannotBlacklistBot'),
    });
  }

  try {
    // Add to blacklist
    await db.insert(blacklist).values({
      userId: user.id,
      guildId: interaction.guild!.id,
      reason,
      blacklistedBy: interaction.user.id,
    });

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle(t('commands.blacklist.subcommands.user.success.title'))
      .setDescription(t('commands.blacklist.subcommands.user.success.description', {
        user: user.tag,
      }))
      .addFields(
        {
          name: t('commands.blacklist.subcommands.user.success.reason'),
          value: reason,
          inline: false,
        },
        {
          name: t('commands.blacklist.subcommands.user.success.blacklistedBy'),
          value: interaction.user.tag,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error blacklisting user:', error);
    await interaction.editReply({
      content: t('commands.blacklist.error'),
    });
  }
}

async function handleBlacklistView(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const page = interaction.options.getInteger('page') || 1;
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  // Get blacklisted users
  const blacklistedUsers = await db
    .select()
    .from(blacklist)
    .where(eq(blacklist.guildId, interaction.guild!.id))
    .orderBy(desc(blacklist.blacklistedAt))
    .limit(pageSize)
    .offset(offset);

  if (blacklistedUsers.length === 0) {
    return interaction.editReply({
      content: t('commands.blacklist.subcommands.view.noBlacklisted'),
    });
  }

  // Get total count
  const [{ count }] = await db
    .select({ count: blacklist.userId })
    .from(blacklist)
    .where(eq(blacklist.guildId, interaction.guild!.id));

  const totalPages = Math.ceil(Number(count) / pageSize);

  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle(t('commands.blacklist.subcommands.view.title'))
    .setDescription(t('commands.blacklist.subcommands.view.description', {
      page,
      totalPages,
    }))
    .setTimestamp();

  // Add blacklisted users
  for (const entry of blacklistedUsers) {
    const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
    const blacklistedBy = await interaction.client.users.fetch(entry.blacklistedBy).catch(() => null);

    embed.addFields({
      name: user ? user.tag : entry.userId,
      value: [
        `**${t('commands.blacklist.subcommands.view.reason')}:** ${entry.reason}`,
        `**${t('commands.blacklist.subcommands.view.blacklistedBy')}:** ${blacklistedBy ? blacklistedBy.tag : entry.blacklistedBy}`,
        `**${t('commands.blacklist.subcommands.view.date')}:** <t:${Math.floor(entry.blacklistedAt.getTime() / 1000)}:F>`,
      ].join('\n'),
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleBlacklistRemove(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);

  try {
    // Remove from blacklist
    const deleted = await db
      .delete(blacklist)
      .where(
        and(
          eq(blacklist.userId, user.id),
          eq(blacklist.guildId, interaction.guild!.id)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return interaction.editReply({
        content: t('commands.blacklist.subcommands.remove.notBlacklisted'),
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(t('commands.blacklist.subcommands.remove.success.title'))
      .setDescription(t('commands.blacklist.subcommands.remove.success.description', {
        user: user.tag,
      }))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error removing user from blacklist:', error);
    await interaction.editReply({
      content: t('commands.blacklist.error'),
    });
  }
}