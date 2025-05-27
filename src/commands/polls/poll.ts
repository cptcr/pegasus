// src/commands/polls/poll.ts - Fixed Poll Commands
import { ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';
import { Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Poll system commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new poll')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Poll title')
            .setRequired(true)
            .setMaxLength(256)
        )
        .addStringOption(option =>
          option
            .setName('options')
            .setDescription('Poll options separated by semicolons (;)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Poll description')
            .setMaxLength(1024)
        )
        .addStringOption(option =>
          option
            .setName('duration')
            .setDescription('Poll duration (e.g., 1d, 12h, 30m)')
        )
        .addBooleanOption(option =>
          option
            .setName('multiple')
            .setDescription('Allow multiple choices')
        )
        .addBooleanOption(option =>
          option
            .setName('anonymous')
            .setDescription('Make poll anonymous')
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to post the poll in')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('End an active poll')
        .addIntegerOption(option =>
          option
            .setName('poll_id')
            .setDescription('Poll ID to end')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List active polls in this guild')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('participants')
        .setDescription('View poll participants')
        .addIntegerOption(option =>
          option
            .setName('poll_id')
            .setDescription('Poll ID to check')
            .setRequired(true)
        )
    ),
  category: 'polls',
  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a guild.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handlePollCreate(interaction, client);
        break;
      case 'end':
        await handlePollEnd(interaction, client);
        break;
      case 'list':
        await handlePollList(interaction, client);
        break;
      case 'participants':
        await handlePollParticipants(interaction, client);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
        break;
    }
  }
};

async function handlePollCreate(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  await interaction.deferReply();

  const title = interaction.options.getString('title', true);
  const optionsStr = interaction.options.getString('options', true);
  const description = interaction.options.getString('description');
  const durationStr = interaction.options.getString('duration');
  const allowMultiple = interaction.options.getBoolean('multiple') || false;
  const anonymous = interaction.options.getBoolean('anonymous') || false;
  const targetChannel = interaction.options.getChannel('channel');

  // Parse options
  const options = optionsStr.split(';').map(opt => opt.trim()).filter(opt => opt.length > 0);

  if (options.length < 2) {
    await interaction.editReply('Poll must have at least 2 options.');
    return;
  }

  if (options.length > Config.POLL.MAX_OPTIONS) {
    await interaction.editReply(`Poll cannot have more than ${Config.POLL.MAX_OPTIONS} options.`);
    return;
  }

  // Parse duration
  let duration: number | undefined;
  if (durationStr) {
    duration = parsePollDuration(durationStr);
    if (!duration) {
      await interaction.editReply('Invalid duration format. Use formats like: 1d, 12h, 30m');
      return;
    }
  }

  const channelId = targetChannel?.id || interaction.channelId;

  const result = await client.pollManager.createPoll(interaction.guild!, {
    title,
    description: description || undefined,
    options,
    duration,
    allowMultiple,
    anonymous,
    creatorId: interaction.user.id,
    channelId
  });

  if (!result.success) {
    await interaction.editReply(`Failed to create poll: ${result.error}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Poll Created`)
    .setDescription(`Successfully created poll: **${title}**`)
    .addFields(
      { name: 'Poll ID', value: result.poll!.id.toString(), inline: true },
      { name: 'Options', value: options.length.toString(), inline: true },
      { name: 'Channel', value: `<#${channelId}>`, inline: true }
    )
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  if (duration) {
    embed.addFields({ 
      name: 'Duration', 
      value: `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`, 
      inline: true 
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handlePollEnd(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  await interaction.deferReply();

  const pollId = interaction.options.getInteger('poll_id', true);

  const poll = await client.pollManager.getPoll(pollId);
  if (!poll) {
    await interaction.editReply('Poll not found.');
    return;
  }

  if (poll.guildId !== interaction.guild!.id) {
    await interaction.editReply('Poll not found in this guild.');
    return;
  }

  if (!poll.active) {
    await interaction.editReply('Poll is already ended.');
    return;
  }

  // Check permissions
  if (poll.creatorId !== interaction.user.id && 
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    await interaction.editReply('You can only end polls you created, or you need Manage Messages permission.');
    return;
  }

  const result = await client.pollManager.endPoll(pollId, interaction.user.id);

  if (!result.success) {
    await interaction.editReply(`Failed to end poll: ${result.error}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Poll Ended`)
    .setDescription(`Successfully ended poll: **${poll.title}**`)
    .addFields(
      { name: 'Poll ID', value: pollId.toString(), inline: true },
      { name: 'Total Votes', value: poll.votes.length.toString(), inline: true }
    )
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handlePollList(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  await interaction.deferReply();

  const activePolls = await client.pollManager.getActivePolls(interaction.guild!.id);

  if (activePolls.length === 0) {
    await interaction.editReply('No active polls in this guild.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.POLL} Active Polls`)
    .setDescription(`${activePolls.length} active poll(s)`)
    .setColor(Config.COLORS.INFO)
    .setTimestamp();

  for (let i = 0; i < Math.min(activePolls.length, 10); i++) {
    const poll = activePolls[i];
    const creator = await interaction.client.users.fetch(poll.creatorId).catch(() => null);
    const uniqueVoters = new Set(poll.votes.map(vote => vote.userId)).size;
    
    embed.addFields({
      name: `ID: ${poll.id} - ${poll.title}`,
      value: `**Creator:** ${creator?.displayName || poll.creatorId}\n**Channel:** <#${poll.channelId}>\n**Votes:** ${uniqueVoters} participant(s)\n**Created:** <t:${Math.floor(poll.createdAt.getTime() / 1000)}:R>${poll.endTime ? `\n**Ends:** <t:${Math.floor(poll.endTime.getTime() / 1000)}:R>` : ''}`,
      inline: false
    });
  }

  if (activePolls.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${activePolls.length} polls` });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handlePollParticipants(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  await interaction.deferReply();

  const pollId = interaction.options.getInteger('poll_id', true);

  const poll = await client.pollManager.getPoll(pollId);
  if (!poll) {
    await interaction.editReply('Poll not found.');
    return;
  }

  if (poll.guildId !== interaction.guild!.id) {
    await interaction.editReply('Poll not found in this guild.');
    return;
  }

  if (poll.anonymous && poll.creatorId !== interaction.user.id && 
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    await interaction.editReply('This is an anonymous poll. Only the creator or moderators can view participants.');
    return;
  }

  const participants = await client.pollManager.getPollParticipants(pollId);

  if (participants.length === 0) {
    await interaction.editReply('No participants in this poll yet.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.POLL} Poll Participants`)
    .setDescription(`**${poll.title}**\n\n${participants.length} participant(s)`)
    .setColor(Config.COLORS.INFO)
    .setTimestamp();

  const participantList = participants.slice(0, 20).map(user => `• ${user.displayName}`).join('\n');
  embed.addFields({ name: 'Participants', value: participantList });

  if (participants.length > 20) {
    embed.setFooter({ text: `Showing 20 of ${participants.length} participants` });
  }

  await interaction.editReply({ embeds: [embed] });
}

// Helper function to parse duration strings for polls
function parsePollDuration(duration: string): number | undefined {
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

export default command;