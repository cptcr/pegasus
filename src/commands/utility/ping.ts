// src/commands/utility/ping.ts - Basic ping command
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong! Shows bot latency.');

export async function run({ interaction, client }: any) {
  try {
    const sent = await interaction.reply({ 
      content: 'Pinging...', 
      fetchReply: true,
      ephemeral: true 
    });

    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '📶 Bot Latency', value: `${latency}ms`, inline: true },
        { name: '💓 API Latency', value: `${apiLatency}ms`, inline: true },
        { name: '🤖 Status', value: 'Online', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Hinko Bot v2.0.0' });

    await interaction.editReply({ 
      content: '', 
      embeds: [embed] 
    });

  } catch (error) {
    console.error('Error in ping command:', error);
    
    const errorMessage = {
      content: '❌ An error occurred while executing this command.',
      embeds: [],
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}