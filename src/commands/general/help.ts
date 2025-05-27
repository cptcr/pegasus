// src/commands/general/help.ts - Enhanced Dynamic Help Command
import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChatInputCommandInteraction, 
  ComponentType 
} from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata, CategoryInfo } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: 'help',
  description: 'Display comprehensive help information for bot commands',
  category: 'general',
  usage: '/help [command]',
  examples: [
    '/help',
    '/help ping',
    '/help moderation',
    '/help ban'
  ],
  cooldown: 5,
  guildOnly: false
};

const categoryInfo: Record<string, CategoryInfo> = {
  general: {
    name: 'General',
    description: 'Basic bot commands and utilities',
    emoji: '📋',
    color: 0x5865F2
  },
  moderation: {
    name: 'Moderation',
    description: 'Server moderation and management tools',
    emoji: '🔨',
    color: 0xFF0000
  },
  fun: {
    name: 'Fun',
    description: 'Entertainment and interactive commands',
    emoji: '🎉',
    color: 0x00FF00
  },
  utility: {
    name: 'Utility',
    description: 'Helpful tools and information commands',
    emoji: '🔧',
    color: 0x00FFFF
  },
  community: {
    name: 'Community',
    description: 'Community engagement and social features',
    emoji: '👥',
    color: 0xFF69B4
  },
  stats: {
    name: 'Statistics',
    description: 'Server and user statistics',
    emoji: '📊',
    color: 0x9932CC
  },
  leveling: {
    name: 'Leveling',
    description: 'XP and level management system',
    emoji: '📈',
    color: 0x32CD32
  },
  polls: {
    name: 'Polls',
    description: 'Create and manage polls',
    emoji: '📊',
    color: 0x9932CC
  },
  giveaway: {
    name: 'Giveaways',
    description: 'Host and manage giveaways',
    emoji: '🎁',
    color: 0xFFD700
  },
  tickets: {
    name: 'Tickets',
    description: 'Support ticket system',
    emoji: '🎫',
    color: 0xFFA500
  },
  quarantine: {
    name: 'Quarantine',
    description: 'User quarantine management',
    emoji: '🔒',
    color: 0xFF4500
  },
  voice: {
    name: 'Voice',
    description: 'Voice channel management',
    emoji: '🔊',
    color: 0x800080
  }
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display comprehensive help information for bot commands')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Get detailed information about a specific command')
        .setRequired(false)
        .setAutocomplete(true)),
  category: 'general',
  cooldown: 5,
  
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    const commandName = interaction.options.getString('command');
    
    if (commandName) {
      // Show specific command help
      const command = client.commands.get(commandName);
      if (!command) {
        return interaction.reply({
          content: `❌ Command \`${commandName}\` not found.`,
          ephemeral: true
        });
      }
      
      const commandMetadata = (command as any).metadata as CommandMetadata;
      const embed = await createCommandDetailEmbed(command, commandMetadata, client);
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    // Show general help with categories
    const categories = new Map<string, Command[]>();
    
    client.commands.forEach((cmd) => {
      if (!categories.has(cmd.category)) {
        categories.set(cmd.category, []);
      }
      categories.get(cmd.category)!.push(cmd);
    });
    
    const embed = createMainHelpEmbed(client, categories);
    const components = createCategorySelectMenu(categories);
    
    const response = await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true
    });
    
    // Handle interactions
    const collector = response.createMessageComponentCollector({
      time: 300000 // 5 minutes
    });
    
    collector.on('collect', async (componentInteraction) => {
      if (componentInteraction.user.id !== interaction.user.id) {
        return componentInteraction.reply({
          content: '❌ This help menu is not for you.',
          ephemeral: true
        });
      }
      
      try {
        if (componentInteraction.isStringSelectMenu()) {
          await handleCategorySelect(componentInteraction, categories, client);
        } else if (componentInteraction.isButton()) {
          await handleButtonInteraction(componentInteraction, client, categories);
        }
      } catch (error) {
        client.logger.error('Error handling help interaction:', error);
      }
    });
    
    collector.on('end', () => {
      // Disable components when collector ends
      const disabledComponents = components.map(row => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach(component => {
          if ('setDisabled' in component) {
            component.setDisabled(true);
          }
        });
        return newRow;
      });
      
      interaction.editReply({ components: disabledComponents }).catch(() => {});
    });
  }
};

function createMainHelpEmbed(client: ExtendedClient, categories: Map<string, Command[]>): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${client.user?.username} Command Help`)
    .setDescription(`
    Welcome to **${client.user?.username}**! Here's what I can do:
    
    **🚀 Quick Stats:**
    • **${client.commands.size}** commands available
    • **${categories.size}** categories
    • **${client.guilds.cache.size}** servers served
    
    **📋 How to use this help:**
    • Select a category below to browse commands
    • Use \`/help <command>\` for detailed command info
    • Commands marked with 🔒 require special permissions
    `)
    .setColor(Config.COLORS.PRIMARY)
    .setThumbnail(client.user?.displayAvatarURL())
    .setTimestamp();
    
  // Add category overview
  let categoryList = '';
  categories.forEach((commands, categoryName) => {
    const info = categoryInfo[categoryName] || { emoji: '📁', name: categoryName };
    categoryList += `${info.emoji} **${info.name}** - ${commands.length} commands\n`;
  });
  
  embed.addFields({ 
    name: '📚 Available Categories', 
    value: categoryList || 'No categories found',
    inline: false 
  });
  
  embed.setFooter({ 
    text: `Use the dropdown below to explore commands • Page 1/1`,
    iconURL: client.user?.displayAvatarURL()
  });
  
  return embed;
}

function createCategorySelectMenu(categories: Map<string, Command[]>): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help-category')
    .setPlaceholder('🔍 Choose a category to explore...')
    .setMinValues(1)
    .setMaxValues(1);
    
  categories.forEach((commands, categoryName) => {
    const info = categoryInfo[categoryName] || { 
      name: categoryName.charAt(0).toUpperCase() + categoryName.slice(1), 
      description: `${categoryName} commands`,
      emoji: '📁'
    };
    
    selectMenu.addOptions({
      label: info.name,
      value: categoryName,
      description: `${commands.length} commands • ${info.description}`,
      emoji: info.emoji
    });
  });
  
  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  
  // Navigation buttons
  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('help-home')
        .setLabel('🏠 Home')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('help-search')
        .setLabel('🔍 Search Commands')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('help-support')
        .setLabel('💬 Support')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('help-invite')
        .setLabel('➕ Invite Bot')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands`)
    );
  
  return [row1, row2];
}

async function handleCategorySelect(
  interaction: any,
  categories: Map<string, Command[]>,
  client: ExtendedClient
): Promise<void> {
  const selectedCategory = interaction.values[0];
  const categoryCommands = categories.get(selectedCategory) || [];
  const info = categoryInfo[selectedCategory] || { 
    name: selectedCategory,
    description: `${selectedCategory} commands`,
    emoji: '📁',
    color: 0x5865F2
  };
  
  const embed = new EmbedBuilder()
    .setTitle(`${info.emoji} ${info.name} Commands`)
    .setDescription(info.description)
    .setColor(info.color)
    .setTimestamp();
  
  // Group commands by permissions and add fields
  const publicCommands = categoryCommands.filter(cmd => {
    const meta = (cmd as any).metadata as CommandMetadata;
    return !meta?.permissions?.length && !meta?.ownerOnly;
  });
  
  const restrictedCommands = categoryCommands.filter(cmd => {
    const meta = (cmd as any).metadata as CommandMetadata;
    return meta?.permissions?.length || meta?.ownerOnly;
  });
  
  if (publicCommands.length > 0) {
    const commandList = publicCommands
      .map(cmd => {
        const meta = (cmd as any).metadata as CommandMetadata;
        return `**/${cmd.data.name}** - ${meta?.description || cmd.data.description}`;
      })
      .join('\n');
    
    embed.addFields({
      name: '✅ Public Commands',
      value: commandList.length > 1024 ? commandList.substring(0, 1021) + '...' : commandList,
      inline: false
    });
  }
  
  if (restrictedCommands.length > 0) {
    const commandList = restrictedCommands
      .map(cmd => {
        const meta = (cmd as any).metadata as CommandMetadata;
        const permissions = meta?.permissions?.join(', ') || 'Special';
        return `**/${cmd.data.name}** - ${meta?.description || cmd.data.description}\n  *Requires: ${permissions}*`;
      })
      .join('\n\n');
    
    embed.addFields({
      name: '🔒 Restricted Commands',
      value: commandList.length > 1024 ? commandList.substring(0, 1021) + '...' : commandList,
      inline: false
    });
  }
  
  embed.addFields({
    name: '💡 Pro Tip',
    value: `Use \`/help <command>\` for detailed information about any specific command.`,
    inline: false
  });
  
  embed.setFooter({
    text: `${categoryCommands.length} commands in ${info.name} • Use /help <command> for details`,
    iconURL: client.user?.displayAvatarURL()
  });
  
  await interaction.update({ embeds: [embed] });
}

async function handleButtonInteraction(
  interaction: any,
  client: ExtendedClient,
  categories: Map<string, Command[]>
): Promise<void> {
  const customId = interaction.customId;
  
  switch (customId) {
    case 'help-home':
      const mainEmbed = createMainHelpEmbed(client, categories);
      await interaction.update({ embeds: [mainEmbed] });
      break;
      
    case 'help-search':
      const searchEmbed = new EmbedBuilder()
        .setTitle('🔍 Command Search')
        .setDescription(`
        **How to find commands:**
        • Use \`/help <command name>\` for specific commands
        • Browse categories using the dropdown menu
        • All commands support Discord's built-in autocomplete
        
        **Popular Commands:**
        • \`/help\` - Show this help menu
        • \`/ping\` - Check bot latency
        • \`/stats\` - View server statistics
        • \`/poll create\` - Create a poll
        • \`/giveaway create\` - Start a giveaway
        `)
        .setColor(Config.COLORS.INFO)
        .setTimestamp();
      
      await interaction.update({ embeds: [searchEmbed] });
      break;
      
    case 'help-support':
      const supportEmbed = new EmbedBuilder()
        .setTitle('💬 Support & Resources')
        .setDescription(`
        **Need help?**
        • Report bugs: [GitHub Issues](https://github.com/cptcr/pegasus/issues)
        
        **Quick Links:**
        • Developer Contact: https://cptcr.dev/contact
        • Source Code: https://github.com/cptcr/pegasus/
        `)
        .setColor(Config.COLORS.SUCCESS)
        .addFields(
          {
            name: '📊 Bot Stats',
            value: `
            **Servers:** ${client.guilds.cache.size}
            **Users:** ${client.users.cache.size}
            **Commands:** ${client.commands.size}
            **Uptime:** ${formatUptime(client.uptime || 0)}
            `,
            inline: true
          },
          {
            name: '🔧 System Info',
            value: `
            **Node.js:** ${process.version}
            **Discord.js:** 14.x
            **Memory:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
            **Platform:** ${process.platform}
            `,
            inline: true
          }
        )
        .setTimestamp();
      
      await interaction.update({ embeds: [supportEmbed] });
      break;
  }
}

async function createCommandDetailEmbed(
  command: Command, 
  metadata: CommandMetadata | undefined, 
  client: ExtendedClient
): Promise<EmbedBuilder> {
  const meta = metadata || {
    name: command.data.name,
    description: command.data.description,
    category: command.category
  };
  
  const categoryInfo_ = categoryInfo[command.category] || { 
    emoji: '📁', 
    color: 0x5865F2,
    name: command.category
  };
  
  const embed = new EmbedBuilder()
    .setTitle(`${categoryInfo_.emoji} /${meta.name}`)
    .setDescription(meta.description)
    .setColor(categoryInfo_.color)
    .addFields(
      { 
        name: '📂 Category', 
        value: categoryInfo_.name, 
        inline: true 
      },
      { 
        name: '⏱️ Cooldown', 
        value: `${meta.cooldown || command.cooldown || 3} seconds`, 
        inline: true 
      }
    )
    .setTimestamp();
  
  if (meta.usage) {
    embed.addFields({ name: '💡 Usage', value: `\`${meta.usage}\``, inline: false });
  }
  
  if (meta.examples && meta.examples.length > 0) {
    embed.addFields({
      name: '📝 Examples',
      value: meta.examples.map(ex => `\`${ex}\``).join('\n'),
      inline: false
    });
  }
  
  if (meta.permissions && meta.permissions.length > 0) {
    embed.addFields({
      name: '🔒 Required Permissions',
      value: meta.permissions.map(perm => `• ${perm}`).join('\n'),
      inline: false
    });
  }
  
  if (meta.aliases && meta.aliases.length > 0) {
    embed.addFields({
      name: '🔄 Aliases',
      value: meta.aliases.map(alias => `\`${alias}\``).join(', '),
      inline: false
    });
  }
  
  // Add flags
  const flags: string[] = [];
  if (meta.guildOnly) flags.push('🏠 Server Only');
  if (meta.ownerOnly) flags.push('👑 Owner Only');
  if (meta.nsfw) flags.push('🔞 NSFW');
  if (meta.premium) flags.push('⭐ Premium');
  
  if (flags.length > 0) {
    embed.addFields({
      name: '🏷️ Flags',
      value: flags.join(' • '),
      inline: false
    });
  }
  
  if (meta.subcommands && meta.subcommands.length > 0) {
    const subcommandList = meta.subcommands
      .map(sub => `**${sub.name}** - ${sub.description}`)
      .join('\n');
    
    embed.addFields({
      name: '📋 Subcommands',
      value: subcommandList,
      inline: false
    });
  }
  
  embed.setFooter({
    text: `Command help • Use /help for more commands`,
    iconURL: client.user?.displayAvatarURL()
  });
  
  return embed;
}

function formatUptime(uptime: number): string {
  const seconds = Math.floor((uptime / 1000) % 60);
  const minutes = Math.floor((uptime / (1000 * 60)) % 60);
  const hours = Math.floor((uptime / (1000 * 60 * 60)) % 24);
  const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

export default command;