// src/commands/general/help.ts
import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ExtendedClient } from '@/index';
import { Config } from '@/config/Config';

interface CommandData {
  name: string;
  description: string;
  category?: string;
}

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Get detailed information about a specific command')
        .setRequired(false)
    ),
  category: 'general',
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    const commandName = interaction.options.getString('command');

    if (commandName) {
      // Show detailed info for specific command
      const command = client.commands.get(commandName);
      
      if (!command) {
        return interaction.reply({
          content: `❌ Command \`${commandName}\` not found.`,
          ephemeral: true
        });
      }

      const commandData: CommandData = {
        name: command.data.name,
        description: command.data.description,
        category: command.category
      };

      const embed = new EmbedBuilder()
        .setTitle(`Command: /${commandData.name}`)
        .setDescription(commandData.description)
        .setColor(Config.COLORS.INFO)
        .addFields(
          { name: 'Category', value: commandData.category || 'Unknown', inline: true },
          { name: 'Cooldown', value: `${command.cooldown || Config.COOLDOWNS.GLOBAL} seconds`, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // Show all commands grouped by category
    const categories = new Map<string, CommandData[]>();

    client.commands.forEach((command: { category: string; data: { name: any; description: any; }; }) => {
      const category = command.category || 'Other';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      
      const commandData: CommandData = {
        name: command.data.name,
        description: command.data.description,
        category: command.category
      };
      
      categories.get(category)!.push(commandData);
    });

    const embed = new EmbedBuilder()
      .setTitle(`${Config.EMOJIS.INFO} Pegasus Bot Commands`)
      .setDescription('Here are all available commands. Use `/help <command>` for detailed information.')
      .setColor(Config.COLORS.PRIMARY)
      .setTimestamp()
      .setFooter({ text: `Total Commands: ${client.commands.size}` });

    categories.forEach((commands, categoryName) => {
      const commandList = commands
        .map(cmd => `\`/${cmd.name}\` - ${cmd.description}`)
        .join('\n');
      
      embed.addFields({
        name: `📁 ${categoryName} (${commands.length})`,
        value: commandList || 'No commands',
        inline: false
      });
    });

    await interaction.reply({ embeds: [embed] });
  },
};