import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  REST,
  Routes,
  MessageFlags
} from 'discord.js';
import { premiumHandler } from '../../handlers/premium';
import { createSuccessEmbed, createErrorEmbed, createEmbed } from '../../utils/helpers';
import { colors, emojis } from '../../utils/config';

declare global {
  var pendingGuildCommands: Map<string, any>;
}

export const data = new SlashCommandBuilder()
  .setName('customcommand')
  .setDescription('Create and manage guild-installed custom commands (Premium Feature)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create a new guild-installed custom command')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('The command name (e.g., "rules")')
          .setRequired(true)
          .setMaxLength(32)
      )
      .addStringOption(option =>
        option.setName('description')
          .setDescription('Brief description of what this command does')
          .setRequired(true)
          .setMaxLength(100)
      )
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Response type')
          .setRequired(true)
          .addChoices(
            { name: 'Rich Embed', value: 'embed' },
            { name: 'Plain Text', value: 'text' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all custom commands in this guild')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete a custom command')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('The command name to delete')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('info')
      .setDescription('View premium information and command limits')
  )
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create':
      await handleCreate(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
    case 'delete':
      await handleDelete(interaction);
      break;
    case 'info':
      await handleInfo(interaction);
      break;
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  // Check premium access
  const hasPremium = await premiumHandler.hasFeature(interaction.guild.id, 'custom_commands');
  if (!hasPremium) {
    const embed = createErrorEmbed(
      '🔒 Premium Feature',
      'Custom commands are a premium feature. Upgrade your server to access this functionality!'
    );
    embed.addFields([
      {
        name: '✨ Premium Benefits',
        value: '• Create up to 25 custom commands (Premium) or 100 (Enterprise)\n• Guild-installed commands with native Discord integration\n• Advanced logging features\n• Priority support\n• Custom branding options',
        inline: false
      },
      {
        name: '📞 Contact',
        value: 'Contact our support team to upgrade your server!',
        inline: false
      }
    ]);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const commandName = interaction.options.getString('name', true).toLowerCase();
  const description = interaction.options.getString('description', true);
  const responseType = interaction.options.getString('type', true) as 'embed' | 'text';

  // Validate command names
  if (!/^[a-z0-9_-]+$/.test(commandName)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Invalid Name', 'Command names can only contain lowercase letters, numbers, hyphens, and underscores.')],
      ephemeral: true
    });
  }

  // Reserved command names
  const reservedCommands = [
    'ping', 'help', 'config', 'warn', 'ban', 'kick', 'mute', 'ticket', 'giveaway', 
    'trivia', 'balance', 'daily', 'work', 'shop', 'customcommand', 'logging', 'language'
  ];

  if (reservedCommands.includes(commandName)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Reserved Command', 'This command name is reserved and cannot be used for custom commands.')],
      ephemeral: true
    });
  }

  // Create modal for content input
  const modal = new ModalBuilder()
    .setCustomId(`guildcommand_create_${responseType}_${commandName}`)
    .setTitle(`Create ${responseType === 'embed' ? 'Embed' : 'Text'} Response`);

  if (responseType === 'embed') {
    const titleInput = new TextInputBuilder()
      .setCustomId('embed_title')
      .setLabel('Embed Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(256);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('embed_description')
      .setLabel('Embed Description')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(4000);

    const colorInput = new TextInputBuilder()
      .setCustomId('embed_color')
      .setLabel('Embed Color (hex code, e.g., #ff0000)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(7)
      .setPlaceholder('#0099ff');

    const footerInput = new TextInputBuilder()
      .setCustomId('embed_footer')
      .setLabel('Embed Footer')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(2048);

    const imageInput = new TextInputBuilder()
      .setCustomId('embed_image')
      .setLabel('Image URL (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(2048)
      .setPlaceholder('https://example.com/image.png');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(footerInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput)
    );
  } else {
    const contentInput = new TextInputBuilder()
      .setCustomId('text_content')
      .setLabel('Text Response')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000)
      .setPlaceholder('Enter the text response for this command...');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput)
    );
  }

  // Store the command info for the modal handler
  const commandInfo = {
    commandName,
    description,
    responseType,
    creatorId: interaction.user.id,
    guildId: interaction.guild.id
  };

  // We'll handle this in the modal submit handler
  global.pendingGuildCommands = global.pendingGuildCommands || new Map();
  global.pendingGuildCommands.set(interaction.user.id, commandInfo);

  await interaction.showModal(modal);
}

async function handleList(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const commands = await premiumHandler.getGuildCommands(interaction.guild.id);

  if (commands.length === 0) {
    return interaction.editReply({
      embeds: [createErrorEmbed('No Commands Found', 'No custom commands have been created in this guild.')]
    });
  }

  const embed = createSuccessEmbed(
    '📋 Guild Custom Commands',
    'All custom commands in this guild'
  );

  const commandList = commands.map(cmd => 
    `• \`/${cmd.command_name}\` - ${cmd.description}\n  *Used ${cmd.usage_count} times*`
  ).join('\n');

  embed.addFields([{
    name: `📁 Commands (${commands.length})`,
    value: commandList,
    inline: false
  }]);

  await interaction.editReply({ embeds: [embed] });
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const commandName = interaction.options.getString('name', true).toLowerCase();

  // Find the command to delete
  const commands = await premiumHandler.getGuildCommands(interaction.guild.id);
  const targetCommand = commands.find(cmd => cmd.command_name === commandName);

  if (!targetCommand) {
    return interaction.reply({
      embeds: [createErrorEmbed('Command Not Found', `No custom command "${commandName}" found in this guild.`)],
      ephemeral: true
    });
  }

  const result = await premiumHandler.deleteGuildCommand(
    interaction.guild.id,
    targetCommand.id,
    interaction.user.id
  );

  if (result.success) {
    await interaction.reply({
      embeds: [createSuccessEmbed('Command Deleted', `Successfully deleted \`/${commandName}\``)],
      ephemeral: true
    });
  } else {
    await interaction.reply({
      embeds: [createErrorEmbed('Delete Failed', result.message)],
      ephemeral: true
    });
  }
}

async function handleInfo(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const premiumInfo = await premiumHandler.getPremiumInfo(interaction.guild.id);

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.crown} Premium Information`)
    .setColor(premiumInfo.isPremium ? colors.success as any : colors.warning as any)
    .setDescription(premiumInfo.isPremium ? 
      'This guild has premium access!' : 
      'This guild does not have premium access.'
    );

  embed.addFields([
    {
      name: '🎫 Current Tier',
      value: premiumInfo.tier.charAt(0).toUpperCase() + premiumInfo.tier.slice(1),
      inline: true
    },
    {
      name: '📊 Custom Commands',
      value: `${premiumInfo.currentCustomCommands}/${premiumInfo.maxCustomCommands}`,
      inline: true
    },
    {
      name: '✨ Features',
      value: premiumInfo.features.length > 0 ? premiumInfo.features.map((f: any) => `• ${f.replace('_', ' ')}`).join('\n') : 'None',
      inline: false
    }
  ]);

  if (premiumInfo.expiresAt) {
    embed.addFields([{
      name: '⏰ Expires',
      value: `<t:${Math.floor(new Date(premiumInfo.expiresAt).getTime() / 1000)}:R>`,
      inline: true
    }]);
  }

  if (!premiumInfo.isPremium) {
    embed.addFields([{
      name: '🚀 Upgrade Benefits',
      value: '• **Premium**: 25 custom commands\n• **Enterprise**: 100 custom commands\n• Guild-installed commands with native Discord integration\n• Advanced logging features\n• Priority support\n• Custom branding options',
      inline: false
    }]);
  }

  await interaction.editReply({ embeds: [embed] });
}

// Handle modal submissions for guild command creation
export async function handleModalSubmit(interaction: any) {
  if (!interaction.customId.startsWith('guildcommand_create_')) return;

  const [, , responseType, commandName] = interaction.customId.split('_');
  
  // Get stored command info
  const commandInfo = global.pendingGuildCommands?.get(interaction.user.id);
  if (!commandInfo) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'Command creation session expired. Please try again.')],
      ephemeral: true
    });
  }

  // Clear the pending command
  global.pendingGuildCommands.delete(interaction.user.id);

  let responseData: any;

  if (responseType === 'embed') {
    const title = interaction.fields.getTextInputValue('embed_title') || null;
    const description = interaction.fields.getTextInputValue('embed_description') || null;
    const color = interaction.fields.getTextInputValue('embed_color') || '#0099ff';
    const footer = interaction.fields.getTextInputValue('embed_footer') || null;
    const image = interaction.fields.getTextInputValue('embed_image') || null;

    // Validate hex color
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (color && !hexColorRegex.test(color)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Invalid Color', 'Please provide a valid hex color code (e.g., #ff0000).')],
        ephemeral: true
      });
    }

    // Validate image URL
    if (image && !image.startsWith('http')) {
      return interaction.reply({
        embeds: [createErrorEmbed('Invalid Image URL', 'Image URL must start with http:// or https://.')],
        ephemeral: true
      });
    }

    responseData = {
      title,
      description,
      color,
      footer,
      image
    };
  } else {
    const content = interaction.fields.getTextInputValue('text_content');
    responseData = { content };
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Create the guild command
  const result = await premiumHandler.createGuildCommand(
    commandInfo.guildId,
    commandInfo.commandName,
    commandInfo.description,
    commandInfo.creatorId,
    responseType as 'embed' | 'text',
    responseData
  );

  if (result.success) {
    const embed = createSuccessEmbed('✅ Guild Command Created!', result.message);
    embed.addFields([
      {
        name: '📝 Command Details',
        value: `**Command:** \`/${commandInfo.commandName}\`\n**Type:** ${responseType === 'embed' ? 'Rich Embed' : 'Plain Text'}\n**Description:** ${commandInfo.description}`,
        inline: false
      },
      {
        name: '💡 Usage',
        value: `Users can now run \`/${commandInfo.commandName}\` to see your custom response!`,
        inline: false
      },
      {
        name: '🔄 Synchronization',
        value: 'The command has been registered with Discord and should appear in the slash command menu shortly.',
        inline: false
      }
    ]);

    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply({
      embeds: [createErrorEmbed('Creation Failed', result.message)]
    });
  }
}