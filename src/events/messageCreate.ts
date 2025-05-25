import { Events, Message } from 'discord.js';
import { ClientWithCommands, Event, PrefixCommand } from '../types';
import { getGuildSettings } from '../utils/guildSettings';
import { handleCooldown } from '../utils/cooldown';

const event: Event<typeof Events.MessageCreate> = {
  name: Events.MessageCreate,
  async execute(client: ClientWithCommands, message: Message) {
    if (message.author.bot || !message.guild || !client.user) return;

    let guildSettings;
    try {
        guildSettings = await getGuildSettings(message.guild.id, client);
    } catch (error) {
        console.error(`Fehler beim Abrufen der Gildeneinstellungen für ${message.guild.id}:`, error);
        guildSettings = { prefix: client.config.defaultPrefix };
    }
    
    const prefix = guildSettings?.prefix || client.config.defaultPrefix;

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = client.commands.get(commandName) ||
      client.commands.find(cmd => !!cmd.aliases && cmd.aliases.includes(commandName)) as PrefixCommand | undefined;

    if (!command) return;

    if (command.devOnly && !client.config.devUsers.includes(message.author.id)) {
      await message.reply('⚠️ Dieser Befehl kann nur von Bot-Entwicklern verwendet werden.');
      return;
    }

    const cooldownResult = handleCooldown({
      userId: message.author.id,
      commandName: command.name,
      cooldownAmount: command.cooldown || 0,
    }, client);

    if (cooldownResult.onCooldown) {
      await message.reply(`⏱️ Bitte warte noch ${cooldownResult.remainingTime.toFixed(1)} Sekunden, bevor du diesen Befehl erneut verwendest.`);
      return;
    }

    try {
      await command.execute(message, args, client);
    } catch (error) {
      console.error(`Fehler beim Ausführen des Befehls ${command.name}:`, error);
      await message.reply('Beim Ausführen dieses Befehls ist ein interner Fehler aufgetreten!');
    }
  }
};

export default event;