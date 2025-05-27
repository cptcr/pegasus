// src/commands/general/ping.ts
import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ExtendedClient } from '@/index';
import { Config } from '@/config/Config';

interface PingData {
  latency: number;
  apiLatency: number;
  uptime: number;
}

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency and status'),
  category: 'general',
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    const startTime = Date.now();
    
    await interaction.reply({
      content: '🏓 Pinging...',
      ephemeral: true
    });

    const endTime = Date.now();
    
    const pingData: PingData = {
      latency: endTime - interaction.createdTimestamp,
      apiLatency: Math.round(client.ws.ping),
      uptime: Math.floor((client.uptime || 0) / 1000)
    };

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(Config.COLORS.SUCCESS)
      .addFields(
        {
          name: '📡 Bot Latency',
          value: `${pingData.latency}ms`,
          inline: true
        },
        {
          name: '🌐 API Latency',
          value: `${pingData.apiLatency}ms`,
          inline: true
        },
        {
          name: '⏱️ Uptime',
          value: formatUptime(pingData.uptime),
          inline: true
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Bot Status' });

    // Add status indicator based on latency
    if (pingData.apiLatency < 100) {
      embed.setDescription('🟢 Excellent connection');
    } else if (pingData.apiLatency < 200) {
      embed.setDescription('🟡 Good connection');
    } else {
      embed.setDescription('🔴 Poor connection');
      embed.setColor(Config.COLORS.WARNING);
    }

    await interaction.editReply({
      content: null,
      embeds: [embed]
    });
  },
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

  return parts.join(' ');
}