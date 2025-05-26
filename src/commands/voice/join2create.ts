// src/commands/voice/join2create.ts - Join2Create System Commands
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  EmbedBuilder,
  ChannelType,
  CategoryChannel
} from 'discord.js';
import { ExtendedClient } from '../../index.js';
import { Join2CreateManager } from '../../modules/voice/Join2CreateManager.js';
import { Config } from '../../config/Config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('join2create')
    .setDescription('Join to Create voice channel system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Setup Join to Create system')
        .addChannelOption(option =>
          option
            .setName('category')
            .setDescription('Category where temporary channels will be created')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addStringOption(option =>
          option
            .setName('channel_name')
            .setDescription('Name for the Join to Create channel')
        )
        .addIntegerOption(option =>
          option
            .setName('user_limit')
            .setDescription('Default user limit for created channels (0 = unlimited)')
            .setMinValue(0)
            .setMaxValue(99)
        )
        .addIntegerOption(option =>
          option
            .setName('bitrate')
            .setDescription('Default bitrate for created channels (in kbps)')
            .setMinValue(8)
            .setMaxValue(384)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable Join to Create system')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('settings')
        .setDescription('Configure Join to Create settings')
        .addStringOption(option =>
          option
            .setName('setting')
            .setDescription('Setting to configure')
            .setRequired(true)
            .addChoices(
              { name: 'Name Template', value: 'name_template' },
              { name: 'User Limit', value: 'user_limit' },
              { name: 'Bitrate', value: 'bitrate' },
              { name: 'Allow Text Channel', value: 'allow_text' },
              { name: 'Auto Delete Empty', value: 'auto_delete' },
              { name: 'Lock Empty Channels', value: 'lock_empty' }
            )
        )
        .addStringOption(option =>
          option
            .setName('value')
            .setDescription('New value for the setting')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('blacklist')
        .setDescription('Manage Join to Create blacklist')
        .addStringOption(option =>
          option
            .setName('action')
            .setDescription('Blacklist action')
            .setRequired(true)
            .addChoices(
              { name: 'Add User', value: 'add' },
              { name: 'Remove User', value: 'remove' },
              { name: 'View List', value: 'list' }
            )
        )
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to add/remove from blacklist')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('cleanup')
        .setDescription('Clean up all temporary voice channels')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('View Join to Create system information')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as ExtendedClient;
    const j2cManager = new Join2CreateManager(client, client.db, client.logger);
    
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a guild.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'setup':
        await handleJ2CSetup(interaction, j2cManager);
        break;
      case 'disable':
        await handleJ2CDisable(interaction, j2cManager);
        break;
      case 'settings':
        await handleJ2CSettings(interaction, j2cManager);
        break;
      case 'blacklist':
        await handleJ2CBlacklist(interaction, j2cManager);
        break;
      case 'cleanup':
        await handleJ2CCleanup(interaction, j2cManager);
        break;
      case 'info':
        await handleJ2CInfo(interaction, j2cManager);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
        break;
    }
  }
};

async function handleJ2CSetup(interaction: ChatInputCommandInteraction, j2cManager: Join2CreateManager): Promise<void> {
  await interaction.deferReply();

  const category = interaction.options.getChannel('category', true) as CategoryChannel;
  const channelName = interaction.options.getString('channel_name') || '➕ Join to Create';
  const userLimit = interaction.options.getInteger('user_limit') || 0;
  const bitrate = interaction.options.getInteger('bitrate') || 64;

  const result = await j2cManager.setupJoin2Create(interaction.guild!, {
    categoryId: category.id,
    channelName,
    userLimit,
    bitrate: bitrate * 1000 // Convert to bps
  });

  if (!result.success) {
    await interaction.editReply(`Failed to setup Join to Create: ${result.error}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Join to Create Setup`)
    .setDescription('Join to Create system has been configured successfully!')
    .addFields(
      { name: 'Join Channel', value: `<#${result.channel!.id}>`, inline: true },
      { name: 'Category', value: `${category.name}`, inline: true },
      { name: 'User Limit', value: userLimit === 0 ? 'Unlimited' : userLimit.toString(), inline: true },
      { name: 'Bitrate', value: `${bitrate} kbps`, inline: true }
    )
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleJ2CDisable(interaction: ChatInputCommandInteraction, j2cManager: Join2CreateManager): Promise<void> {
  await interaction.deferReply();

  const result = await j2cManager.disableJoin2Create(interaction.guild!.id);

  if (!result.success) {
    await interaction.editReply(`Failed to disable Join to Create: ${result.error}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Join to Create Disabled`)
    .setDescription('Join to Create system has been disabled.')
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  if (result.cleanedChannels && result.cleanedChannels > 0) {
    embed.addFields({ 
      name: 'Cleanup', 
      value: `Removed ${result.cleanedChannels} temporary channels.` 
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleJ2CSettings(interaction: ChatInputCommandInteraction, j2cManager: Join2CreateManager): Promise<void> {
  await interaction.deferReply();

  const setting = interaction.options.getString('setting', true);
  const value = interaction.options.getString('value', true);

  const settings: Record<string, any> = {};

  switch (setting) {
    case 'name_template':
      settings.channelNameTemplate = value;
      break;
    case 'user_limit':
      const limit = parseInt(value);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        await interaction.editReply('User limit must be between 0 and 99.');
        return;
      }
      settings.defaultUserLimit = limit;
      break;
    case 'bitrate':
      const bitrate = parseInt(value);
      if (isNaN(bitrate) || bitrate < 8 || bitrate > 384) {
        await interaction.editReply('Bitrate must be between 8 and 384 kbps.');
        return;
      }
      settings.defaultBitrate = bitrate * 1000;
      break;
    case 'allow_text':
      settings.allowTextChannel = value.toLowerCase() === 'true';
      break;
    case 'auto_delete':
      settings.autoDeleteEmpty = value.toLowerCase() === 'true';
      break;
    case 'lock_empty':
      settings.lockEmptyChannels = value.toLowerCase() === 'true';
      break;
  }

  const result = await j2cManager.updateSettings(interaction.guild!.id, settings);

  if (!result.success) {
    await interaction.editReply(`Failed to update settings: ${result.error}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Settings Updated`)
    .setDescription(`Successfully updated ${setting.replace(/_/g, ' ')} to: **${value}**`)
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleJ2CBlacklist(interaction: ChatInputCommandInteraction, j2cManager: Join2CreateManager): Promise<void> {
  await interaction.deferReply();

  const action = interaction.options.getString('action', true);
  const user = interaction.options.getUser('user');

  if (action === 'list') {
    const blacklist = await j2cManager.getBlacklist(interaction.guild!.id);
    
    if (blacklist.length === 0) {
      await interaction.editReply('No users are blacklisted from Join to Create.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🚫 Join to Create Blacklist')
      .setDescription(`${blacklist.length} user(s) blacklisted`)
      .setColor(Config.COLORS.WARNING)
      .setTimestamp();

    const userList = await Promise.all(
      blacklist.slice(0, 20).map(async (userId) => {
        const fetchedUser = await interaction.client.users.fetch(userId).catch(() => null);
        return fetchedUser ? `• ${fetchedUser.tag} (${userId})` : `• Unknown User (${userId})`;
      })
    );

    embed.addFields({ name: 'Blacklisted Users', value: userList.join('\n') });

    if (blacklist.length > 20) {
      embed.setFooter({ text: `Showing 20 of ${blacklist.length} users` });
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (!user) {
    await interaction.editReply('Please specify a user for this action.');
    return;
  }

  let result;
  if (action === 'add') {
    result = await j2cManager.addToBlacklist(interaction.guild!.id, user.id);
  } else { // 'remove'
    result = await j2cManager.removeFromBlacklist(interaction.guild!.id, user.id);
  }

  if (!result.success) {
    await interaction.editReply(`Failed to ${action} user: ${result.error}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Blacklist Updated`)
    .setDescription(`${user.tag} has been ${action === 'add' ? 'added to' : 'removed from'} the blacklist.`)
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleJ2CCleanup(interaction: ChatInputCommandInteraction, j2cManager: Join2CreateManager): Promise<void> {
  await interaction.deferReply();

  const result = await j2cManager.cleanupChannels(interaction.guild!.id);

  if (!result.success) {
    await interaction.editReply(`Failed to cleanup channels: ${result.error}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Cleanup Complete`)
    .setDescription(`Cleaned up ${result.cleanedChannels || 0} temporary voice channels.`)
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleJ2CInfo(interaction: ChatInputCommandInteraction, j2cManager: Join2CreateManager): Promise<void> {
  await interaction.deferReply();

  const settings = await j2cManager.getSettings(interaction.guild!.id);
  
  if (!settings) {
    await interaction.editReply('Join to Create is not configured for this guild.');
    return;
  }

  const activeChannels = await j2cManager.getActiveChannels(interaction.guild!.id);
  const blacklist = await j2cManager.getBlacklist(interaction.guild!.id);

  // Destructure settings for cleaner access and provide defaults
  const { 
    enableJoinToCreate,
    joinToCreateChannelId,
    joinToCreateCategoryId,
    defaultUserLimit = 0,
    channelNameTemplate,
    defaultBitrate,
    allowTextChannel,
    autoDeleteEmpty,
    lockEmptyChannels
  } = settings;

  const embed = new EmbedBuilder()
    .setTitle('🎤 Join to Create Information')
    .setDescription('Current configuration and statistics')
    .addFields(
      { name: 'Status', value: enableJoinToCreate ? '🟢 Enabled' : '🔴 Disabled', inline: true },
      { name: 'Join Channel', value: joinToCreateChannelId ? `<#${joinToCreateChannelId}>` : 'Not set', inline: true },
      { name: 'Category', value: joinToCreateCategoryId ? `<#${joinToCreateCategoryId}>` : 'Not set', inline: true },
      { name: 'Active Channels', value: activeChannels.length.toString(), inline: true },
      { name: 'Blacklisted Users', value: blacklist.length.toString(), inline: true },
      { name: 'Default User Limit', value: defaultUserLimit === 0 ? 'Unlimited' : defaultUserLimit.toString(), inline: true }
    )
    .setColor(Config.COLORS.INFO)
    .setTimestamp();

  const configDetails = [];
  if (channelNameTemplate) {
    configDetails.push(`**Name Template:** \`${channelNameTemplate}\``);
  }
  if (defaultBitrate) {
    configDetails.push(`**Default Bitrate:** ${defaultBitrate / 1000} kbps`);
  }
  if (allowTextChannel !== undefined) {
    configDetails.push(`**Allow Text Channels:** ${allowTextChannel ? 'Yes' : 'No'}`);
  }
  if (autoDeleteEmpty !== undefined) {
    configDetails.push(`**Auto Delete Empty:** ${autoDeleteEmpty ? 'Yes' : 'No'}`);
  }
  if (lockEmptyChannels !== undefined) {
    configDetails.push(`**Lock Empty Channels:** ${lockEmptyChannels ? 'Yes' : 'No'}`);
  }

  if (configDetails.length > 0) {
    embed.addFields({ 
      name: 'Configuration', 
      value: configDetails.join('\n'), 
      inline: false 
    });
  }

  await interaction.editReply({ embeds: [embed] });
}