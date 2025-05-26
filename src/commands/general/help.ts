// src/commands/general/help.ts
import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ExtendedClient } from '@/index';
import { Config } from '@/config/Config';
import { Command } from '@/types';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Lists all available commands or info about a specific command.')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('The command you want help with')
        .setRequired(false)),
  
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    const commandName = interaction.options.getString('command');

    if (!commandName) {
      // Display all commands
      const embed = new EmbedBuilder()
        .setColor(Config.COLORS.INFO)
        .setTitle('Pegasus Bot Commands')
        .setDescription('Here is a list of all available commands. For more details on a specific command, use `/help [command_name]`.')
        .setTimestamp();

      // Group commands by category (inferred from file path)
      const commandsByCategory: Map<string, Command[]> = new Map();
      client.commands.forEach(cmd => {
        // This assumes your command loader stores the category on the command object
        // If not, you'd need to adjust how the category is determined.
        // Let's assume the CommandHandler sets a `category` property.
        const category = (cmd as any).category || 'General';
        const categoryCommands = commandsByCategory.get(category) || [];
        categoryCommands.push(cmd);
        commandsByCategory.set(category, categoryCommands);
      });

      commandsByCategory.forEach((cmds, category) => {
        const commandList = cmds.map(c => `\`${c.data.name}\``).join(', ');
        embed.addFields({ name: `🔹 ${category.charAt(0).toUpperCase() + category.slice(1)}`, value: commandList });
      });
      
      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else {
      // Display details for a specific command
      const command = client.commands.get(commandName.toLowerCase());
      if (!command) {
        return interaction.reply({ content: `Sorry, I couldn't find a command called \`${commandName}\`.`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(Config.COLORS.INFO)
        .setTitle(`Help: \`/${command.data.name}\``)
        .setDescription(command.data.description)
        .setTimestamp();

      if (command.data.options.length > 0) {
        const optionsString = command.data.options.map(opt => {
          const option = opt.toJSON();
          const required = 'required' in option && option.required ? ' (Required)' : '';
          return `\`${option.name}\`: ${option.description}${required}`;
        }).join('\n');
        embed.addFields({ name: 'Options', value: optionsString });
      }

      if (command.cooldown) {
        embed.addFields({ name: 'Cooldown', value: `${command.cooldown} second(s)` });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
} as Command;