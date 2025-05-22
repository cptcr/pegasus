// src/commands/utility/help.ts
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show help information')
  .addStringOption(option =>
    option.setName('category')
      .setDescription('Command category to show')
      .addChoices(
        { name: 'Utility', value: 'utility' },
        { name: 'Moderation', value: 'moderation' },
        { name: 'Leveling', value: 'leveling' },
        { name: 'Community', value: 'community' },
        { name: 'Music', value: 'music' }
      )
  );

export async function run({ interaction }: { interaction: any }) {
  const category = interaction.options.getString('category');
  
  if (category) {
    await showCategoryHelp(interaction, category);
  } else {
    await showMainHelp(interaction);
  }
}

async function showMainHelp(interaction: any) {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🤖 Hinko Bot - Help')
    .setDescription('Welcome to Hinko Bot! Here are the available command categories:')
    .addFields(
      {
        name: '🛠️ Utility',
        value: 'Basic bot commands and utilities',
        inline: true
      },
      {
        name: '🛡️ Moderation',
        value: 'Server moderation tools',
        inline: true
      },
      {
        name: '📊 Leveling',
        value: 'User level and XP system',
        inline: true
      },
      {
        name: '🎉 Community',
        value: 'Polls, giveaways, and fun features',
        inline: true
      },
      {
        name: '🎵 Music',
        value: 'Music playback commands',
        inline: true
      },
      {
        name: '🌐 Dashboard',
        value: 'Access the web dashboard for advanced configuration',
        inline: false
      }
    )
    .setFooter({
      text: 'Use the buttons below or /help <category> for specific commands',
      iconURL: interaction.client.user.displayAvatarURL()
    })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('help_utility')
        .setLabel('Utility')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🛠️'),
      new ButtonBuilder()
        .setCustomId('help_moderation')
        .setLabel('Moderation')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🛡️'),
      new ButtonBuilder()
        .setCustomId('help_leveling')
        .setLabel('Leveling')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId('help_community')
        .setLabel('Community')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎉')
    );

  await interaction.reply({
    embeds: [embed],
    components: [row]
  });
}

async function showCategoryHelp(interaction: any, category: string) {
  const embeds: { [key: string]: EmbedBuilder } = {
    utility: new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle('🛠️ Utility Commands')
      .setDescription('Basic bot utilities and information commands')
      .addFields(
        { name: '/ping', value: 'Check bot latency and status', inline: false },
        { name: '/help', value: 'Show this help menu', inline: false },
        { name: '/serverinfo', value: 'Display server information', inline: false },
        { name: '/userinfo', value: 'Display user information', inline: false }
      ),

    moderation: new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🛡️ Moderation Commands')
      .setDescription('Server moderation and administration tools')
      .addFields(
        { name: '/warn', value: 'Warn a user', inline: false },
        { name: '/warnings', value: 'View user warnings', inline: false },
        { name: '/clearwarns', value: 'Clear user warnings', inline: false },
        { name: '/quarantine', value: 'Quarantine a user', inline: false },
        { name: '/unquarantine', value: 'Remove user from quarantine', inline: false },
        { name: '/automod', value: 'Configure automatic moderation', inline: false }
      ),

    leveling: new Embe