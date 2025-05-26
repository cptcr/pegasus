// src/commands/general/help.ts - Help Command
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('Get help for a specific command')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as ExtendedClient;
    const commandName = interaction.options.getString('command');

    if (commandName) {
      // Show help for specific command
      const command = client.commands.get(commandName);
      
      if (!command) {
        await interaction.reply({ 
          content: `❌ Command \`${commandName}\` not found.`,
          ephemeral: true 
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.INFO} Help - /${commandName}`)
        .setDescription(command.data.description || 'No description available')
        .setColor(Config.COLORS.INFO)
        .addFields(
          { name: 'Usage', value: `\`/${commandName}\``, inline: true },
          { name: 'Category', value: getCommandCategory(commandName), inline: true }
        )
        .setTimestamp();

      if (command.data.options && command.data.options.length > 0) {
        const options = command.data.options.map((opt: any) => {
          const required = opt.required ? '**[Required]**' : '*[Optional]*';
          return `**${opt.name}** ${required}: ${opt.description}`;
        }).join('\n');

        embed.addFields({ name: 'Options', value: options, inline: false });
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Show all commands grouped by category
    const categories = {
      'General': ['help', 'ping', 'info'],
      'Moderation': ['quarantine', 'warn', 'kick', 'ban'],
      'Fun & Engagement': ['poll', 'giveaway'],
      'Support': ['ticket'],
      'Utility': ['level', 'stats']
    };

    const embed = new EmbedBuilder()
      .setTitle(`${Config.EMOJIS.INFO} Pegasus Bot - Help`)
      .setDescription('Here are all available commands organized by category.\nUse `/help <command>` for detailed information about a specific command.')
      .setColor(Config.COLORS.PRIMARY)
      .setThumbnail(client.user?.displayAvatarURL() ?? null)
      .setTimestamp();

    for (const [category, commands] of Object.entries(categories)) {
      const availableCommands = commands.filter(cmd => client.commands.has(cmd));
      
      if (availableCommands.length > 0) {
        const commandList = availableCommands.map(cmd => {
          const command = client.commands.get(cmd);
          return `\`/${cmd}\` - ${command?.data.description || 'No description'}`;
        }).join('\n');

        embed.addFields({ 
          name: `${getCategoryEmoji(category)} ${category}`, 
          value: commandList, 
          inline: false 
        });
      }
    }

    embed.addFields(
      { 
        name: '🔗 Links', 
        value: '[Developer](https://cptcr.dev)', 
        inline: false 
      },
      { 
        name: '📊 Bot Stats', 
        value: `Servers: ${client.guilds.cache.size}\nUsers: ${client.users.cache.size}\nCommands: ${client.commands.size}`, 
        inline: true 
      },
      { 
        name: 'ℹ️ Bot Info', 
        value: `Version: v2.0.0\nUptime: <t:${Math.floor((Date.now() - (client.uptime || 0)) / 1000)}:R>\nPing: ${client.ws.ping}ms`, 
        inline: true 
      }
    );

    embed.setFooter({ 
      text: `Requested by ${interaction.user.tag}`, 
      iconURL: interaction.user.displayAvatarURL() 
    });

    await interaction.reply({ embeds: [embed] });
  }
};

function getCommandCategory(commandName: string): string {
  const categories: { [key: string]: string[] } = {
    'General': ['help', 'ping', 'info'],
    'Moderation': ['quarantine', 'warn', 'kick', 'ban'],
    'Fun & Engagement': ['poll', 'giveaway'],
    'Support': ['ticket'],
    'Utility': ['level', 'stats']
  };

  for (const [category, commands] of Object.entries(categories)) {
    if (commands.includes(commandName)) {
      return category;
    }
  }

  return 'Unknown';
}

function getCategoryEmoji(category: string): string {
  const emojis: { [key: string]: string } = {
    'General': '🏠',
    'Moderation': '🛡️',
    'Fun & Engagement': '🎉',
    'Support': '🎫',
    'Utility': '🔧'
  };

  return emojis[category] || '📁';
}