import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType } from 'discord.js';
import { Command } from '@/types/index';
import { ExtendedClient } from '@/index';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display help information for bot commands')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Get detailed information about a specific command')
        .setRequired(false)),
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
      
      const embed = new EmbedBuilder()
        .setTitle(`Help: /${commandName}`)
        .setDescription(command.data.description)
        .setColor(0x5865F2)
        .addFields([
          { name: 'Category', value: command.category, inline: true },
          { name: 'Cooldown', value: `${command.cooldown || 3} seconds`, inline: true }
        ])
        .setTimestamp();
        
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
    
    const embed = new EmbedBuilder()
      .setTitle(`${client.user?.username} Help`)
      .setDescription('Select a category below to view available commands, or use `/help <command>` for detailed information.')
      .setColor(0x5865F2)
      .setThumbnail(client.user?.displayAvatarURL())
      .setTimestamp();
      
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help-category')
      .setPlaceholder('Choose a category...')
      .addOptions(
        Array.from(categories.keys()).map(category => ({
          label: category.charAt(0).toUpperCase() + category.slice(1),
          value: category,
          description: `View ${category} commands`,
          emoji: getCategoryEmoji(category)
        }))
      );
      
    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);
      
    const response = await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    // Handle select menu interactions
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000
    });
    
    collector.on('collect', async (selectInteraction) => {
      if (selectInteraction.user.id !== interaction.user.id) {
        return selectInteraction.reply({
          content: '❌ This help menu is not for you.',
          ephemeral: true
        });
      }
      
      const selectedCategory = selectInteraction.values[0];
      const categoryCommands = categories.get(selectedCategory) || [];
      
      const categoryEmbed = new EmbedBuilder()
        .setTitle(`${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Commands`)
        .setDescription(
          categoryCommands.map((cmd: Command) => 
            `**/${cmd.data.name}** - ${cmd.data.description}`
          ).join('\n')
        )
        .setColor(0x5865F2)
        .setFooter({ text: `Use /help <command> for detailed information` })
        .setTimestamp();
        
      const backButton = new ButtonBuilder()
        .setCustomId('help-back')
        .setLabel('Back to Categories')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️');
        
      const backRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(backButton);
        
      await selectInteraction.update({
        embeds: [categoryEmbed],
        components: [backRow]
      });
    });
    
    // Handle back button
    const buttonCollector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });
    
    buttonCollector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({
          content: '❌ This help menu is not for you.',
          ephemeral: true
        });
      }
      
      if (buttonInteraction.customId === 'help-back') {
        await buttonInteraction.update({
          embeds: [embed],
          components: [row]
        });
      }
    });
    
    collector.on('end', () => {
      selectMenu.setDisabled(true);
      interaction.editReply({ components: [row] }).catch(() => {});
    });
  }
};

function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    'general': '📋',
    'moderation': '🔨',
    'leveling': '📊',
    'fun': '🎉',
    'utility': '🔧',
    'music': '🎵',
    'giveaway': '🎁',
    'poll': '📊',
    'ticket': '🎫'
  };
  return emojis[category] || '📁';
}

export default command;