// src/commands/quarantine/quarantine.ts - Fixed Quarantine Commands
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { ExtendedClient } from '../../index.js';
import { QuarantineManager } from '../../modules/quarantine/QuarantineManager.js';
import { Config } from '../../config/Config.js';

export interface QuarantineEntry {
  id: number;
  guildId: string;
  userId: string; // This should be userId, not targetId
  moderatorId: string;
  reason: string;
  active: boolean;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export default {
  data: new SlashCommandBuilder()
    .setName('quarantine')
    .setDescription('Quarantine system commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Put a user in quarantine')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to quarantine')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for quarantine')
            .setMaxLength(Config.LIMITS.QUARANTINE_REASON_LENGTH)
        )
        .addStringOption(option =>
          option
            .setName('duration')
            .setDescription('Duration (e.g., 1d, 12h, 30m)')
        )
        .addBooleanOption(option =>
          option
            .setName('notify')
            .setDescription('Notify the user via DM')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a user from quarantine')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to unquarantine')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for removal')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check quarantine status of a user')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to check')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('View quarantine history of a user')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to check')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of entries to show')
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all active quarantines')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Setup quarantine system for this guild')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as ExtendedClient;
    const quarantineManager = new QuarantineManager(client, client.db, client.logger);
    
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a guild.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        await handleQuarantineAdd(interaction, quarantineManager);
        break;
      case 'remove':
        await handleQuarantineRemove(interaction, quarantineManager);
        break;
      case 'status':
        await handleQuarantineStatus(interaction, quarantineManager);
        break;
      case 'history':
        await handleQuarantineHistory(interaction, quarantineManager);
        break;
      case 'list':
        await handleQuarantineList(interaction, quarantineManager);
        break;
      case 'setup':
        await handleQuarantineSetup(interaction, quarantineManager);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
        break;
    }
  }
};

async function handleQuarantineAdd(interaction: ChatInputCommandInteraction, quarantineManager: QuarantineManager): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const durationStr = interaction.options.getString('duration');
  const notify = interaction.options.getBoolean('notify') ?? true;

  const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
  if (!member) {
    await interaction.editReply('User not found in this guild.');
    return;
  }

  // Parse duration
  let duration: number | undefined;
  if (durationStr) {
    duration = parseDuration(durationStr);
    if (!duration) {
      await interaction.editReply('Invalid duration format. Use formats like: 1d, 12h, 30m');
      return;
    }
    if (duration > Config.QUARANTINE.MAX_DURATION) {
      await interaction.editReply('Duration cannot exceed 30 days.');
      return;
    }
  }

  const result = await quarantineManager.quarantineUser(interaction.guild!, member, {
    reason,
    duration,
    moderatorId: interaction.user.id,
    notifyUser: notify
  });

  if (!result.success) {
    await interaction.editReply(`Failed to quarantine user: ${result.error}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} User Quarantined`)
    .setDescription(`Successfully quarantined ${user.displayName}`)
    .addFields(
      { name: 'Reason', value: reason, inline: true },
      { 
        name: 'Duration', 
        value: duration ? `<t:${Math.floor((Date.now() + duration) / 1000)}:R>` : 'Indefinite', 
        inline: true 
      }
    )
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleQuarantineRemove(interaction: ChatInputCommandInteraction, quarantineManager: QuarantineManager): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  const result = await quarantineManager.unquarantineUser(
    interaction.guild!,
    user.id,
    interaction.user.id,
    reason
  );

  if (!result.success) {
    await interaction.editReply(`Failed to remove quarantine: ${result.error}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Quarantine Removed`)
    .setDescription(`Successfully removed quarantine from ${user.displayName}`)
    .addFields({ name: 'Reason', value: reason })
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleQuarantineStatus(interaction: ChatInputCommandInteraction, quarantineManager: QuarantineManager): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const status = await quarantineManager.getQuarantineStatus(interaction.guild!.id, user.id);

  if (!status) {
    await interaction.editReply(`${user.displayName} is not currently quarantined.`);
    return;
  }

  const moderator = await interaction.client.users.fetch(status.moderatorId).catch(() => null);

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.QUARANTINE} Quarantine Status`)
    .setDescription(`${user.displayName} is currently quarantined`)
    .addFields(
      { name: 'Reason', value: status.reason, inline: true },
      { name: 'Moderator', value: moderator?.displayName || status.moderatorId, inline: true },
      { name: 'Since', value: `<t:${Math.floor(status.createdAt.getTime() / 1000)}:R>`, inline: true }
    )
    .setColor(Config.COLORS.QUARANTINE)
    .setTimestamp();

  if (status.expiresAt) {
    embed.addFields({ 
      name: 'Expires', 
      value: `<t:${Math.floor(status.expiresAt.getTime() / 1000)}:R>`, 
      inline: true 
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleQuarantineHistory(interaction: ChatInputCommandInteraction, quarantineManager: QuarantineManager): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const limit = interaction.options.getInteger('limit') || 10;

  const history = await quarantineManager.getQuarantineHistory(interaction.guild!.id, user.id, limit);

  if (history.length === 0) {
    await interaction.editReply(`${user.displayName} has no quarantine history.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.QUARANTINE} Quarantine History`)
    .setDescription(`Showing last ${history.length} entries for ${user.displayName}`)
    .setColor(Config.COLORS.INFO)
    .setTimestamp();

  for (let i = 0; i < Math.min(history.length, 10); i++) {
    const entry = history[i];
    const moderator = await interaction.client.users.fetch(entry.moderatorId).catch(() => null);
    
    embed.addFields({
      name: `Entry ${i + 1} ${entry.active ? '(Active)' : ''}`,
      value: `**Reason:** ${entry.reason}\n**Moderator:** ${moderator?.displayName || entry.moderatorId}\n**Date:** <t:${Math.floor(entry.createdAt.getTime() / 1000)}:R>`,
      inline: false
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleQuarantineList(interaction: ChatInputCommandInteraction, quarantineManager: QuarantineManager): Promise<void> {
  await interaction.deferReply();

  const activeQuarantines = await quarantineManager.getActiveQuarantines(interaction.guild!.id);

  if (activeQuarantines.length === 0) {
    await interaction.editReply('No active quarantines in this guild.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.QUARANTINE} Active Quarantines`)
    .setDescription(`${activeQuarantines.length} active quarantine(s)`)
    .setColor(Config.COLORS.INFO)
    .setTimestamp();

  for (let i = 0; i < Math.min(activeQuarantines.length, 10); i++) {
    const entry = activeQuarantines[i];
    const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
    const moderator = await interaction.client.users.fetch(entry.moderatorId).catch(() => null);
    
    embed.addFields({
      name: `${user?.displayName || entry.userId}`,
      value: `**Reason:** ${entry.reason}\n**Moderator:** ${moderator?.displayName || entry.moderatorId}\n**Since:** <t:${Math.floor(entry.createdAt.getTime() / 1000)}:R>${entry.expiresAt ? `\n**Expires:** <t:${Math.floor(entry.expiresAt.getTime() / 1000)}:R>` : ''}`,
      inline: true
    });
  }

  if (activeQuarantines.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${activeQuarantines.length} quarantines` });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleQuarantineSetup(interaction: ChatInputCommandInteraction, quarantineManager: QuarantineManager): Promise<void> {
  await interaction.deferReply();

  const result = await quarantineManager.setupQuarantineRole(interaction.guild!);

  if (!result.success) {
    await interaction.editReply(`Failed to setup quarantine system: ${result.error}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Quarantine System Setup`)
    .setDescription('Successfully setup quarantine system for this guild')
    .addFields(
      { name: 'Quarantine Role', value: `${result.role!.name} (${result.role!.id})`, inline: true },
      { name: 'Permissions', value: 'Configured for all channels', inline: true }
    )
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// Helper function to parse duration strings
function parseDuration(duration: string): number | undefined {
  const regex = /^(\d+)([dhm])$/i;
  const match = duration.match(regex);
  
  if (!match) return undefined;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000; // days to ms
    case 'h': return value * 60 * 60 * 1000; // hours to ms
    case 'm': return value * 60 * 1000; // minutes to ms
    default: return undefined;
  }
}