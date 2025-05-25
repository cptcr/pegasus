import { Collection } from 'discord.js';
import { ClientWithCommands } from '../types';

export function handleCooldown(
  cooldownConfig: {
    userId: string;
    commandName: string;
    cooldownAmount: number;
  },
  client: ClientWithCommands
): { onCooldown: boolean; remainingTime: number } {
  const { userId, commandName, cooldownAmount } = cooldownConfig;

  if (!client.cooldowns.has(commandName)) {
    client.cooldowns.set(commandName, new Collection<string, number>());
  }

  const now = Date.now();
  const timestamps = client.cooldowns.get(commandName)!;
  const cooldownDurationMs = cooldownAmount * 1000;

  const userTimestamp = timestamps.get(userId);

  if (userTimestamp) {
    const expirationTime = userTimestamp + cooldownDurationMs;
    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return { onCooldown: true, remainingTime: timeLeft };
    }
  }

  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), cooldownDurationMs);

  return { onCooldown: false, remainingTime: 0 };
}