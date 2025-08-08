// Temporary mock for rankCardService until canvas is properly installed
import { AttachmentBuilder } from 'discord.js';

export class RankCardService {
  static async generateRankCard(
    user: any,
    rank: number,
    level: number,
    currentXp: number,
    requiredXp: number,
    totalXp: number,
    _customization?: any
  ): Promise<AttachmentBuilder> {
    // Return a simple text attachment instead of canvas image
    const content = `
🏆 **Rank Card**
👤 User: ${user.username}
📊 Rank: #${rank}
📈 Level: ${level}
✨ XP: ${currentXp}/${requiredXp}
🎯 Total XP: ${totalXp}
    `.trim();

    const buffer = Buffer.from(content, 'utf-8');
    return new AttachmentBuilder(buffer, { name: 'rank.txt' });
  }
}
