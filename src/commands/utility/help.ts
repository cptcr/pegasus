import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  CommandInteraction, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ComponentType,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { i18n } from '../../i18n';
import { 
  commandRegistry, 
  getCommandMetadata, 
  getCommandsByCategory, 
  getAllCategories,
  searchCommands,
  CommandMetadata
} from '../../utils/commandRegistry';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Get help with bot commands and features')
  .addStringOption(option =>
    option
      .setName('command')
      .setDescription('Get detailed help for a specific command')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('category')
      .setDescription('Browse commands by category')
      .setRequired(false)
      .addChoices(
        { name: '🛡️ Moderation', value: 'moderation' },
        { name: '⭐ XP System', value: 'xp' },
        { name: '🎫 Tickets', value: 'tickets' },
        { name: '🎉 Giveaways', value: 'giveaways' },
        { name: '🎮 Games', value: 'games' },
        { name: '💰 Economy', value: 'economy' },
        { name: '🔧 Utility', value: 'utility' },
        { name: '🎮 Steam', value: 'steam' },
        { name: '⏰ Reminders', value: 'reminders' },
        { name: '🌐 Language', value: 'language' }
      )
  );

export async function execute(interaction: any) {
  const t = i18n.createTranslator(interaction.user.id, interaction.guildId || undefined);
  const commandName = interaction.options?.get('command')?.value as string;
  const categoryName = interaction.options?.get('category')?.value as string;

  // Use command registry instead of loading from files
  const commands = Object.values(commandRegistry);

  if (commandName) {
    await handleSpecificCommand(interaction, t, commandName, commands);
  } else if (categoryName) {
    await handleCategoryHelp(interaction, t, categoryName, commands);
  } else {
    await handleGeneralHelp(interaction, t, commands);
  }
}

// Removed loadAllCommands function - using command registry instead

async function handleGeneralHelp(interaction: any, t: Function, commands: CommandMetadata[]) {
  const categories = groupCommandsByCategory(commands);
  
  const embed = new EmbedBuilder()
    .setTitle(`🤖 ${t('commands.help.title')} - Pegasus Bot`)
    .setDescription(
      `Welcome to **Pegasus**! A comprehensive Discord bot with advanced features.\n\n` +
      `📚 **Quick Start:**\n` +
      `• Use \`/help <command>\` for detailed command info\n` +
      `• Use \`/help category:<category>\` to browse by category\n` +
      `• Use \`/language set <language>\` to change your language\n\n` +
      `✨ **Key Features:**\n` +
      `• 🛡️ Advanced Moderation • 💰 Economy System • ⭐ XP & Leveling\n` +
      `• 🎫 Ticket Support • 🎉 Giveaways • 🌐 Multi-language Support\n` +
      `• 🤖 AutoMod • 📊 Logging • 🔧 Utility Commands\n\n` +
      `🔗 **Links:**\n` +
      `• [GitHub Repository](https://github.com/cptcr/pegasus)\n` +
      `• [Documentation](https://github.com/cptcr/pegasus/blob/main/README.md)\n`
    )
    .setColor(0x0099ff)
    .setThumbnail(interaction.client.user?.displayAvatarURL() || '')
    .setFooter({ 
      text: `Total Commands: ${commands.length} | Use the menu below to browse categories`,
      iconURL: interaction.user.displayAvatarURL()
    })
    .setTimestamp();

  // Add category overview
  for (const [category, categoryCommands] of Object.entries(categories)) {
    const emoji = getCategoryEmoji(category);
    const commandList = categoryCommands
      .slice(0, 5)
      .map(cmd => `\`${cmd.name}\``)
      .join(', ');
    
    embed.addFields({
      name: `${emoji} ${formatCategoryName(category)} (${categoryCommands.length})`,
      value: commandList + (categoryCommands.length > 5 ? ` and ${categoryCommands.length - 5} more...` : ''),
      inline: true
    });
  }

  // Create category selection menu
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_category_select')
    .setPlaceholder('📋 Select a category to view commands')
    .addOptions(
      Object.keys(categories).map(category => ({
        label: formatCategoryName(category),
        value: category,
        description: `View all ${category} commands`,
        emoji: getCategoryEmoji(category)
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const response = await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });

  // Handle category selection
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 300000 // 5 minutes
  });

  collector.on('collect', async (selectInteraction: any) => {
    if (selectInteraction.user.id !== interaction.user.id) {
      await selectInteraction.reply({
        content: t('errors.permission_denied'),
        ephemeral: true
      });
      return;
    }

    await selectInteraction.deferUpdate();
    const selectedCategory = selectInteraction.values[0];
    await handleCategoryHelp(selectInteraction, t, selectedCategory, commands, true);
  });

  collector.on('end', async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch (error) {
      // Interaction might have been deleted
    }
  });
}

async function handleCategoryHelp(
  interaction: any, 
  t: Function, 
  categoryName: string, 
  commands: CommandMetadata[],
  isUpdate: boolean = false
) {
  const categoryCommands = commands.filter(cmd => cmd.category === categoryName);
  
  if (categoryCommands.length === 0) {
    const content = `❌ No commands found in category "${categoryName}"`;
    if (isUpdate) {
      await interaction.editReply({ content, embeds: [], components: [] });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
    return;
  }

  const emoji = getCategoryEmoji(categoryName);
  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${formatCategoryName(categoryName)} ${t('commands.help.categories')}`)
    .setDescription(`Here are all the ${formatCategoryName(categoryName)} commands available:`)
    .setColor(0x0099ff)
    .setFooter({ 
      text: `Use /help <command> for detailed information about a specific command`,
      iconURL: interaction.user.displayAvatarURL()
    })
    .setTimestamp();

  // Group commands into fields (Discord has a limit of 25 fields)
  const chunkedCommands = chunkArray(categoryCommands, 8);
  
  for (let i = 0; i < chunkedCommands.length && i < 3; i++) {
    const chunk = chunkedCommands[i];
    const fieldValue = chunk.map(cmd => 
      `**/${cmd.name}** - ${cmd.description}`
    ).join('\n');
    
    embed.addFields({
      name: i === 0 ? 'Commands' : `Commands (continued)`,
      value: fieldValue,
      inline: false
    });
  }

  // Back button
  const backButton = new ButtonBuilder()
    .setCustomId('help_back')
    .setLabel('← Back to Overview')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

  const payload = {
    embeds: [embed],
    components: [row]
  };

  if (isUpdate) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply({ ...payload, ephemeral: true });
  }
}

async function handleSpecificCommand(
  interaction: any, 
  t: Function, 
  commandName: string, 
  commands: CommandMetadata[]
) {
  const command = commands.find(cmd => cmd.name.toLowerCase() === commandName.toLowerCase());
  
  if (!command) {
    await interaction.reply({
      content: `❌ Command "${commandName}" not found. Use \`/help\` to see all available commands.`,
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📖 Command: /${command.name}`)
    .setDescription(command.description)
    .setColor(0x0099ff)
    .addFields(
      {
        name: '📂 Category',
        value: `${getCategoryEmoji(command.category)} ${formatCategoryName(command.category)}`,
        inline: true
      }
    );

  if (command.usage) {
    embed.addFields({
      name: t('commands.help.usage'),
      value: `\`${command.usage}\``,
      inline: false
    });
  }

  if (command.permissions && command.permissions.length > 0) {
    embed.addFields({
      name: t('commands.help.permissions'),
      value: command.permissions.map(p => `\`${p}\``).join(', '),
      inline: true
    });
  }

  if (command.cooldown) {
    embed.addFields({
      name: t('commands.help.cooldown'),
      value: `${command.cooldown} seconds`,
      inline: true
    });
  }

  if (command.examples && command.examples.length > 0) {
    embed.addFields({
      name: t('commands.help.examples'),
      value: command.examples.map(ex => `\`${ex}\``).join('\n'),
      inline: false
    });
  }

  embed.setFooter({ 
    text: `Requested by ${interaction.user.username}`,
    iconURL: interaction.user.displayAvatarURL()
  })
  .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

function groupCommandsByCategory(commands: CommandMetadata[]): Record<string, CommandMetadata[]> {
  const categories: Record<string, CommandMetadata[]> = {};
  
  for (const command of commands) {
    if (!categories[command.category]) {
      categories[command.category] = [];
    }
    categories[command.category].push(command);
  }
  
  return categories;
}

function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    'moderation': '🛡️',
    'xp': '⭐',
    'tickets': '🎫',
    'giveaways': '🎉',
    'games': '🎮',
    'economy': '💰',
    'utility': '🔧',
    'steam': '🎮',
    'reminders': '⏰',
    'language': '🌐'
  };
  
  return emojis[category] || '📝';
}

function formatCategoryName(category: string): string {
  const names: Record<string, string> = {
    'moderation': 'Moderation',
    'xp': 'XP System',
    'tickets': 'Tickets',
    'giveaways': 'Giveaways',
    'games': 'Games',
    'economy': 'Economy',
    'utility': 'Utility',
    'steam': 'Steam',
    'reminders': 'Reminders',
    'language': 'Language'
  };
  
  return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

// Helper functions removed - using command registry metadata instead

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}