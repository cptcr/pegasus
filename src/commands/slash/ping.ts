// src/commands/slash/ping.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Überprüft die Latenz des Bots und antwortet mit Pong!'),
  enabled: true,
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const sent = await interaction.reply({ content: 'Pinge...', fetchReply: true, ephemeral: true });
    const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const websocketPing = client.ws.ping;

    await interaction.editReply(
      `🏓 Pong!\n` +
      `Latenz: ${roundtripLatency}ms.\n` +
      `WebSocket Ping: ${websocketPing}ms.`
    );
  }
};

export default command;
