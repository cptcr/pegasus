// src/commands/general/ping.ts - Ping Command
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency and response time'),

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as ExtendedClient;
    
    // Record the time before sending the reply
    const sent = await interaction.reply({ 
      content: '🏓 Pinging...', 
      fetchReply: true 
    });

    // Calculate latencies
    const roundTripLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const websocketLatency = client.ws.ping;

    // Determine latency status and color
    let status = '';
    let color = Config.COLORS.SUCCESS;

    if (roundTripLatency < 100 && websocketLatency < 100) {
      status = '🟢 Excellent';
      color = Config.COLORS.SUCCESS;
    } else if (roundTripLatency < 200 && websocketLatency < 200) {
      status = '🟡 Good';
      color = Config.COLORS.WARNING;
    } else if (roundTripLatency < 500 && websocketLatency < 500) {
      status = '🟠 Fair';
      color = '#FFA500' as any;
    } else {
      status = '🔴 Poor';
      color = Config.COLORS.ERROR;
    }

    // Create detailed embed
    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setDescription(`Bot latency and connection information`)
      .setColor(color)
      .addFields(
        { 
          name: '📡 Round Trip Latency', 
          value: `\`${roundTripLatency}ms\``, 
          inline: true 
        },
        { 
          name: '💓 WebSocket Latency', 
          value: `\`${websocketLatency}ms\``, 
          inline: true 
        },
        { 
          name: '📊 Status', 
          value: status, 
          inline: true 
        },
        {
          name: '⏱️ Uptime',
          value: client.uptime ? `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>` : 'Unknown',
          inline: true
        },
        {
          name: '💾 Memory Usage',
          value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          inline: true
        },
        {
          name: '📈 Process ID',
          value: `\`${process.pid}\``,
          inline: true
        }
      )
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`, 
        iconURL: interaction.user.displayAvatarURL() 
      })
      .setTimestamp();

    // Add shard information if applicable
    if (client.shard) {
      embed.addFields({
        name: '🔀 Shard',
        value: `${client.shard.ids[0]}/${client.shard.count - 1}`,
        inline: true
      });
    }

    await interaction.editReply({ 
      content: '', 
      embeds: [embed] 
    });
  }
};