import { Message } from 'discord.js';
import { PrefixCommand, ClientWithCommands } from '../../../types';

const command: PrefixCommand = {
  name: 'ping',
  aliases: ['pong', 'latenz'],
  description: 'Überprüft die Latenz des Bots.',
  usage: 'ping',
  category: 'utility',
  enabled: true,
  cooldown: 5,
  async execute(message: Message, _args: string[], client: ClientWithCommands) {
    const msg = await message.reply('Pinge...');
    const roundtripLatency = msg.createdTimestamp - message.createdTimestamp;
    const websocketPing = client.ws.ping;

    await msg.edit(
      `🏓 Pong!\n` +
      `Latenz: ${roundtripLatency}ms.\n` +
      `API Latenz: ${websocketPing}ms.`
    );
  }
};

export default command;