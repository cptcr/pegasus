// Temporary mock for rankCardService until canvas is properly installed
import { AttachmentBuilder } from 'discord.js';

interface User {
  username: string;
}

interface Customization {
  backgroundColor?: string;
  progressBarColor?: string;
  textColor?: string;
  accentColor?: string;
}

export class RankCardService {
  static generateRankCard(
    user: User,
    rank: number,
    level: number,
    currentXp: number,
    requiredXp: number,
    totalXp: number,
    _customization?: Customization
  ): AttachmentBuilder {
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
