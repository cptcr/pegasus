import { User } from 'discord.js';
import { DatabaseService } from '../lib/database';

/**
 * Creates a level card without using canvas
 * This is a simplified version that returns a URL to a placeholder image
 */
export async function createLevelCard(userLevel: any, user: User): Promise<Buffer | string> {
  // Instead of generating an image, we'll return a URL to a placeholder image service
  // In a real implementation, you might want to use a service like Canva API or similar
  
  // Format the user's level information for the placeholder
  const level = userLevel.level;
  const xp = userLevel.xp;
  const currentLevelXP = DatabaseService.calculateXPForLevel(level);
  const nextLevelXP = DatabaseService.calculateXPForLevel(level + 1);
  const progressXP = xp - currentLevelXP;
  const neededXP = nextLevelXP - currentLevelXP;
  
  // Return a descriptive string instead of an image
  return `User: ${user.username} | Level: ${level} | XP: ${progressXP}/${neededXP} | Total XP: ${xp}`;
}

/**
 * Creates a leaderboard card without using canvas
 * This is a simplified version that returns formatted text
 */
export async function createLeaderboardCard(users: any[], guildName: string): Promise<Buffer | string> {
  // Format the leaderboard as text
  let leaderboard = `🏆 ${guildName} Leaderboard 🏆\n\n`;
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const rank = i + 1;
    const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    
    leaderboard += `${rankEmoji} ${user.user.username} - Level ${user.level} (${user.xp.toLocaleString()} XP)\n`;
  }
  
  return leaderboard;
}