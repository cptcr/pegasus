// src/events/messageCreate.ts - Behandelt Prefix-Befehle und andere nachrichtenbasierte Features
import { Events, Message } from 'discord.js';
import { ClientWithCommands, Event, PrefixCommand } from '../types'; // ClientWithCommands verwenden
import { getGuildSettings } from '../utils/guildSettings'; // Gilden-Einstellungen Helfer
import { handleCooldown } from '../utils/cooldown'; // Cooldown-Helfer

const event: Event<typeof Events.MessageCreate> = {
  name: Events.MessageCreate,
  async execute(client: ClientWithCommands, message: Message) { // Client als erstes Argument
    // Ignoriert Nachrichten von Bots und wenn keine Gilde vorhanden ist
    if (message.author.bot || !message.guild || !client.user) return;

    // Gildeneinstellungen abrufen (mit Fallback auf Standard-Prefix)
    let guildSettings;
    try {
        guildSettings = await getGuildSettings(message.guild.id, client);
    } catch (error) {
        console.error(`Fehler beim Abrufen der Gildeneinstellungen für ${message.guild.id}:`, error);
        // Fallback oder Standardeinstellungen verwenden, falls gewünscht
        guildSettings = { prefix: client.config.defaultPrefix };
    }
    
    const prefix = guildSettings?.prefix || client.config.defaultPrefix;

    // Prüft, ob die Nachricht mit dem Prefix beginnt
    if (!message.content.startsWith(prefix)) return;

    // Extrahiert Befehlsnamen und Argumente
    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    // Findet den Befehl anhand des Namens oder Alias
    const command = client.commands.get(commandName) ||
      client.commands.find(cmd => !!cmd.aliases && cmd.aliases.includes(commandName)) as PrefixCommand | undefined;

    if (!command) return;

    // Prüft auf devOnly-Befehle
    if (command.devOnly && !client.config.devUsers.includes(message.author.id)) {
      await message.reply('⚠️ Dieser Befehl kann nur von Bot-Entwicklern verwendet werden.');
      return;
    }

    // Handhabt Befehls-Cooldowns
    const cooldownResult = handleCooldown({
      userId: message.author.id,
      commandName: command.name, // Wichtig: command.name verwenden, nicht commandName, für Aliase
      cooldownAmount: command.cooldown || 0,
    }, client);

    if (cooldownResult.onCooldown) {
      await message.reply(`⏱️ Bitte warte noch ${cooldownResult.remainingTime.toFixed(1)} Sekunden, bevor du diesen Befehl erneut verwendest.`);
      return;
    }

    try {
      // Führt den Befehl aus
      await command.execute(message, args, client);
    } catch (error) {
      console.error(`Fehler beim Ausführen des Befehls ${command.name}:`, error);
      await message.reply(' Beim Ausführen dieses Befehls ist ein interner Fehler aufgetreten!');
    }
  }
};

export default event;
