// src/commands/giveaway/giveaway.ts - Fixed Giveaway Commands
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { ExtendedClient } from '../../index.js';
import { GiveawayManager } from '../../modules/giveaways/GiveawayManager.js';
import { Config } from '../../config/Config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveaway system commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new giveaway')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Giveaway title')
            .setRequired(true)
            .setMaxLength(256)
        )
        .addStringOption(option =>
          option
            .setName('prize')
            .setDescription('What is being given away')
            .setRequired(true)
            .setMaxLength(512)
        )
        .addStringOption(option =>
          option
            .setName('duration')
            .setDescription('Giveaway duration (e.g., 1d, 12h, 30m)')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('winners')
            .setDescription('Number of winners')
            .setMinValue(1)
            .setMaxValue(Config.GIVEAWAY.MAX_WINNERS)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Giveaway description')
            .setMaxLength(1024)
        )
        .addRoleOption(option =>
          option
            .setName('required_role')
            .setDescription('Required role to enter')
        )
        .addIntegerOption(option =>
          option
            .setName('required_level')
            .setDescription('Required level to enter')
            .setMinValue(1)
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to post the giveaway in')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('End an active giveaway')
        .addIntegerOption(option =>
          option
            .setName('giveaway_id')
            .setDescription('Giveaway ID to end')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reroll')
        .setDescription('Reroll giveaway winners')
        .addIntegerOption(option =>
          option
            .setName('giveaway_id')
            .setDescription('Giveaway ID to reroll')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List active giveaways')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('participants')
        .setDescription('View giveaway participants')
        .addIntegerOption(option =>
          option
            .setName('giveaway_id')
            .setDescription('Giveaway ID to check')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as ExtendedClient;
    const giveawayManager = new GiveawayManager(client, client.db, client.logger);
    
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a guild.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleGiveawayCreate(interaction, giveawayManager);
        break;
      case 'end':
        await handleGiveawayEnd(interaction, giveawayManager);
        break;
      case 'reroll':
        await handleGiveawayReroll(interaction, giveawayManager);
        break;
      case 'list':
        await handleGiveawayList(interaction, giveawayManager);
        break;
      case 'participants':
        await handleGiveawayParticipants(interaction, giveawayManager);
        break;
    }
  }
};

async function handleGiveawayCreate(interaction: ChatInputCommandInteraction, giveawayManager: GiveawayManager) {
  await interaction.deferReply();

  const title = interaction.options.getString('title', true);
  const prize = interaction.options.getString('prize', true);
  const durationStr = interaction.options.getString('duration', true);
  const winners = interaction.options.getInteger('winners') || 1;
  const description = interaction.options.getString('description');
  const requiredRole = interaction.options.getRole('required_role');
  const requiredLevel = interaction.options.getInteger('required_level');
  const targetChannel = interaction.options.getChannel('channel');

  // Parse duration
  const duration = parseDuration(durationStr);
  if (!duration) {
    return interaction.editReply('Invalid duration format. Use formats like: 1d, 12h, 30m');
  }

  const channelId = targetChannel?.id || interaction.channelId;

  const requirements: any = {};
  if (requiredRole) requirements.roleRequired = requiredRole.id;
  if (requiredLevel) requirements.levelRequired = requiredLevel;

  const result = await giveawayManager.createGiveaway(interaction.guild!, {
    title,
    description: description || undefined,
    prize,
    duration,
    winners,
    creatorId: interaction.user.id,
    channelId,
    requirements: Object.keys(requirements).length > 0 ? requirements : undefined
  });

  if (!result.success) {
    return interaction.editReply(`Failed to create giveaway: ${result.error}`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Giveaway Created`)
    .setDescription(`Successfully created giveaway: **${title}**`)
    .addFields(
      { name: 'Giveaway ID', value: result.giveaway!.id.toString(), inline: true },
      { name: 'Prize', value: prize, inline: true },
      { name: 'Winners', value: winners.toString(), inline: true },
      { name: 'Channel', value: `<#${channelId}>`, inline: true },
      { name: 'Duration', value: `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`, inline: true }
    )
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleGiveawayEnd(interaction: ChatInputCommandInteraction, giveawayManager: GiveawayManager) {
  await interaction.deferReply();

  const giveawayId = interaction.options.getInteger('giveaway_id', true);

  const giveaway = await giveawayManager.getGiveaway(giveawayId);
  if (!giveaway) {
    return interaction.editReply('Giveaway not found.');
  }

  if (giveaway.guildId !== interaction.guild!.id) {
    return interaction.editReply('Giveaway not found in this guild.');
  }

  if (!giveaway.active || giveaway.ended) {
    return interaction.editReply('Giveaway is already ended.');
  }

  // Check permissions
  if (giveaway.creatorId !== interaction.user.id && 
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageEvents)) {
    return interaction.editReply('You can only end giveaways you created, or you need Manage Events permission.');
  }

  const result = await giveawayManager.endGiveaway(giveawayId, interaction.user.id);

  if (!result.success) {
    return interaction.editReply(`Failed to end giveaway: ${result.error}`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Giveaway Ended`)
    .setDescription(`Successfully ended giveaway: **${giveaway.title}**`)
    .addFields(
      { name: 'Giveaway ID', value: giveawayId.toString(), inline: true },
      { name: 'Winners', value: result.winners?.length.toString() || '0', inline: true }
    )
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleGiveawayReroll(interaction: ChatInputCommandInteraction, giveawayManager: GiveawayManager) {
  await interaction.deferReply();

  const giveawayId = interaction.options.getInteger('giveaway_id', true);

  const giveaway = await giveawayManager.getGiveaway(giveawayId);
  if (!giveaway) {
    return interaction.editReply('Giveaway not found.');
  }

  if (giveaway.guildId !== interaction.guild!.id) {
    return interaction.editReply('Giveaway not found in this guild.');
  }

  if (!giveaway.ended) {
    return interaction.editReply('Giveaway must be ended before rerolling.');
  }

  // Check permissions
  if (giveaway.creatorId !== interaction.user.id && 
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageEvents)) {
    return interaction.editReply('You can only reroll giveaways you created, or you need Manage Events permission.');
  }

  const result = await giveawayManager.rerollGiveaway(giveawayId, interaction.user.id);

  if (!result.success) {
    return interaction.editReply(`Failed to reroll giveaway: ${result.error}`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Giveaway Rerolled`)
    .setDescription(`Successfully rerolled giveaway: **${giveaway.title}**`)
    .addFields(
      { name: 'Giveaway ID', value: giveawayId.toString(), inline: true },
      { name: 'New Winners', value: result.winners?.length.toString() || '0', inline: true }
    )
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleGiveawayList(interaction: ChatInputCommandInteraction, giveawayManager: GiveawayManager) {
  await interaction.deferReply();

  const activeGiveaways = await giveawayManager.getActiveGiveaways(interaction.guild!.id);

  if (activeGiveaways.length === 0) {
    return interaction.editReply('No active giveaways in this guild.');
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.GIVEAWAY} Active Giveaways`)
    .setDescription(`${activeGiveaways.length} active giveaway(s)`)
    .setColor(Config.COLORS.INFO)
    .setTimestamp();

  for (let i = 0; i < Math.min(activeGiveaways.length, 10); i++) {
    const giveaway = activeGiveaways[i];
    const creator = await interaction.client.users.fetch(giveaway.creatorId).catch(() => null);
    
    embed.addFields({
      name: `ID: ${giveaway.id} - ${giveaway.title}`,
      value: `**Creator:** ${creator?.tag || giveaway.creatorId}\n**Prize:** ${giveaway.prize}\n**Entries:** ${giveaway.entries.length}\n**Ends:** <t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`,
      inline: false
    });
  }

  if (activeGiveaways.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${activeGiveaways.length} giveaways` });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleGiveawayParticipants(interaction: ChatInputCommandInteraction, giveawayManager: GiveawayManager) {
  await interaction.deferReply();

  const giveawayId = interaction.options.getInteger('giveaway_id', true);

  const giveaway = await giveawayManager.getGiveaway(giveawayId);
  if (!giveaway) {
    return interaction.editReply('Giveaway not found.');
  }

  if (giveaway.guildId !== interaction.guild!.id) {
    return interaction.editReply('Giveaway not found in this guild.');
  }

  const participants = await giveawayManager.getGiveawayParticipants(giveawayId);

  if (participants.length === 0) {
    return interaction.editReply('No participants in this giveaway yet.');
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.GIVEAWAY} Giveaway Participants`)
    .setDescription(`**${giveaway.title}**\n\n${participants.length} participant(s)`)
    .setColor(Config.COLORS.INFO)
    .setTimestamp();

  const participantList = participants.slice(0, 20).map(user => `• ${user.tag}`).join('\n');
  embed.addFields({ name: 'Participants', value: participantList });

  if (participants.length > 20) {
    embed.setFooter({ text: `Showing 20 of ${participants.length} participants` });
  }

  await interaction.editReply({ embeds: [embed] });
}

// Helper function to parse duration strings
function parseDuration(duration: string): number | null {
  const regex = /^(\d+)([dhm])$/i;
  const match = duration.match(regex);
  
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000; // days to ms
    case 'h': return value * 60 * 60 * 1000; // hours to ms
    case 'm': return value * 60 * 1000; // minutes to ms
    default: return null;
  }
}