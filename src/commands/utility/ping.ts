// src/commands/utility/ping.ts
import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { client } from '../../index';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Shows bot latency and API response time');

export async function run({ interaction }: { interaction: CommandInteraction }) {
  const start = Date.now();
  
  await interaction.deferReply();
  
  const latency = Date.now() - start;
  const apiLatency = Math.round(client.ws.ping);
  
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('🏓 Pong!')
    .setDescription('Bot latency information')
    .addFields(
      { name: '⏱️ Bot Latency', value: `${latency}ms`, inline: true },
      { name: '📡 API Latency', value: `${apiLatency}ms`, inline: true },
      { name: '🟢 Status', value: 'Online', inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'Hinko Bot v2.0' });

  await interaction.editReply({ embeds: [embed] });
}