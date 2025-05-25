// src/events/messageCreate.ts - Handle prefix commands and other message-based features
import { Events, Message } from 'discord.js';
import { Client, Event } from '../types';
import { getGuildSettings } from '../utils/guildSettings';
import { handleCooldown } from '../utils/cooldown';

const event: Event<typeof Events.MessageCreate> = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    const client = message.client as Client;
    
    // Ignore messages from bots
    if (message.author.bot) return;
    
    // Skip DM messages or if client user is not available
    if (!message.guild || !client.user) return;

    // Get guild settings with fallback to default prefix
    const guildSettings = await getGuildSettings(message.guild.id, client);
    const prefix = guildSettings.prefix || client.config.defaultPrefix;

    // Check if message starts with the prefix
    if (!message.content.startsWith(prefix)) return;

    // Extract command name and arguments
    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    // Find the command by name or alias
    const command = client.commands.get(commandName) || 
      [...client.commands.values()].find(cmd => cmd.aliases?.includes(commandName));

    if (!command) return;
    
    // Check for dev-only commands
    if (command.devOnly && !client.config.devUsers.includes(message.author.id)) {
      await message.reply('⚠️ This command can only be used by bot developers.');
      return;
    }

    // Handle command cooldowns
    const cooldownResult = handleCooldown({
      userId: message.author.id,
      commandName: commandName,
      cooldownAmount: command.cooldown || 0,
    }, client);

    if (cooldownResult.onCooldown) {
      await message.reply(`⏱️ Please wait ${cooldownResult.remainingTime.toFixed(1)} more seconds before using this command again.`);
      return;
    }

    try {
      await command.execute(message, args);
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      await message.reply('There was an error while executing this command!');
    }
  }
};

export default event;