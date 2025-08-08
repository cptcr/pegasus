// Temporary mock for steamService until axios is properly installed
import { EmbedBuilder } from 'discord.js';

export class SteamService {
  static async getPlayerSummary(steamId: string): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setTitle('Steam Profile (Mock)')
      .setDescription('Steam service is temporarily unavailable')
      .addFields(
        { name: 'Steam ID', value: steamId, inline: true },
        { name: 'Status', value: 'Service temporarily disabled', inline: true }
      )
      .setColor(0x1b2838)
      .setTimestamp();

    return embed;
  }

  static resolveSteamId(input: string): string | null {
    // Simple validation
    if (/^\d{17}$/.test(input)) {
      return input;
    }
    return null;
  }
}
