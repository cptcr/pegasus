// src/commands/prefix/utility/ping.ts
import { Message } from 'discord.js';
import { PrefixCommand, ClientWithCommands } from '../../../types';

const command: PrefixCommand = {
  name: 'ping',
  aliases: ['pong', 'latenz'],
  description: 'Überprüft die Latenz des Bots.',
  usage: 'ping',
  category: 'utility', // Wird automatisch vom Ordnernamen gesetzt, kann aber hier überschrieben werden
  enabled: true,
  cooldown: 5, // 5 Sekunden Cooldown
  async execute(message: Message, args: string[], client: ClientWithCommands) {
    const msg = await message.reply('Pinge...');
    const roundtripLatency = msg.createdTimestamp - message.createdTimestamp;
    const websocketPing = client.ws.ping;

    await msg.edit(
      `🏓 Pong!\n` +
      `Latenz: ${roundtripLatency}ms.\n` +
      `WebSocket Ping: ${websocketPing}ms.`
    );
  }
};

export default command;
