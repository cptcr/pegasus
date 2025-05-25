// src/utils/cooldown.ts
import { Collection } from 'discord.js';
import { ClientWithCommands, CooldownConfig } from '../types';

/**
 * Handhabt Cooldowns für Befehle.
 * @param cooldownConfig Konfiguration für den Cooldown-Check.
 * @param client Der erweiterte Discord-Client.
 * @returns Ein Objekt, das angibt, ob der Benutzer im Cooldown ist und die verbleibende Zeit.
 */
export function handleCooldown(
  cooldownConfig: {
    userId: string;
    commandName: string;
    cooldownAmount: number; // in Sekunden
  },
  client: ClientWithCommands
): { onCooldown: boolean; remainingTime: number } {
  const { userId, commandName, cooldownAmount } = cooldownConfig;

  if (!client.cooldowns.has(commandName)) {
    client.cooldowns.set(commandName, new Collection<string, number>());
  }

  const now = Date.now();
  const timestamps = client.cooldowns.get(commandName)!; // Non-null assertion, da wir es oben setzen
  const cooldownDurationMs = cooldownAmount * 1000;

  const userTimestamp = timestamps.get(userId);

  if (userTimestamp) {
    const expirationTime = userTimestamp + cooldownDurationMs;
    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return { onCooldown: true, remainingTime: timeLeft };
    }
  }

  // Setzt den neuen Timestamp und entfernt ihn nach Ablauf des Cooldowns
  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), cooldownDurationMs);

  return { onCooldown: false, remainingTime: 0 };
}
