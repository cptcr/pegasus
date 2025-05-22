// src/commands/utility/ping.ts
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check bot latency and status');

export async function run({ interaction, client }: { interaction: any; client: any }) {
  const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
  
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('🏓 Pong!')
    .addFields(
      {
        name: '📡 Bot Latency',
        value: `${sent.createdTimestamp - interaction.createdTimestamp}ms`,
        inline: true
      },
      {
        name: '💓 API Latency',
        value: `${Math.round(client.ws.ping)}ms`,
        inline: true
      },
      {
        name: '⏱️ Uptime',
        value: `<t:${Math.floor((Date.now() - (client.uptime || 0)) / 1000)}:R>`,
        inline: true
      }
    )
    .setTimestamp()
    .setFooter({
      text: `Requested by ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL()
    });

  await interaction.editReply({ content: '', embeds: [embed] });
}