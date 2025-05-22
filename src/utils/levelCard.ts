import { createCanvas, loadImage, registerFont } from 'canvas';
import { User } from 'discord.js';
import path from 'path';
import { DatabaseService } from '../lib/database';

// Registriere Schriftarten (falls vorhanden)
try {
  registerFont(path.join(__dirname, '../assets/fonts/Roboto-Bold.ttf'), { family: 'Roboto', weight: 'bold' });
  registerFont(path.join(__dirname, '../assets/fonts/Roboto-Regular.ttf'), { family: 'Roboto' });
} catch {
  // Fallback auf System-Schriftarten
}

export async function createLevelCard(userLevel: any, user: User): Promise<Buffer> {
  const canvas = createCanvas(800, 300);
  const ctx = canvas.getContext('2d');

  // Hintergrund-Gradient
  const gradient = ctx.createLinearGradient(0, 0, 800, 300);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 300);

  // Overlay für bessere Lesbarkeit
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, 800, 300);

  // Avatar laden und zeichnen
  try {
    const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
    
    // Runder Avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(120, 150, 80, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    ctx.drawImage(avatar, 40, 70, 160, 160);
    ctx.restore();
    
    // Avatar Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(120, 150, 80, 0, Math.PI * 2);
    ctx.stroke();
  } catch (error) {
    console.error('Fehler beim Laden des Avatars:', error);
    
    // Fallback Avatar
    ctx.fillStyle = '#36393f';
    ctx.beginPath();
    ctx.arc(120, 150, 80, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(user.username[0].toUpperCase(), 120, 160);
  }

  // Username
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Roboto, Arial';
  ctx.textAlign = 'left';
  ctx.fillText(user.username, 240, 100);

  // Discriminator (falls vorhanden)
  if (user.discriminator && user.discriminator !== '0') {
    ctx.fillStyle = '#b3b3b3';
    ctx.font = '24px Roboto, Arial';
    const usernameWidth = ctx.measureText(user.username).width;
    ctx.fillText(`#${user.discriminator}`, 240 + usernameWidth + 10, 100);
  }

  // Level
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Roboto, Arial';
  ctx.fillText(`Level ${userLevel.level}`, 240, 140);

  // XP Progress
  const currentLevelXP = DatabaseService.calculateXPForLevel(userLevel.level);
  const nextLevelXP = DatabaseService.calculateXPForLevel(userLevel.level + 1);
  const progressXP = userLevel.xp - currentLevelXP;
  const neededXP = nextLevelXP - currentLevelXP;
  const progressPercent = Math.min(progressXP / neededXP, 1);

  // Progress Bar Hintergrund
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(240, 160, 500, 30);

  // Progress Bar
  const progressWidth = 500 * progressPercent;
  const progressGradient = ctx.createLinearGradient(240, 160, 240 + progressWidth, 190);
  progressGradient.addColorStop(0, '#00ff88');
  progressGradient.addColorStop(1, '#00cc66');
  ctx.fillStyle = progressGradient;
  ctx.fillRect(240, 160, progressWidth, 30);

  // Progress Bar Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(240, 160, 500, 30);

  // XP Text
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px Roboto, Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${progressXP} / ${neededXP} XP`, 490, 180);

  // Stats
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Roboto, Arial';
  ctx.textAlign = 'left';
  
  const statsY = 220;
  ctx.fillText(`Gesamt XP: ${userLevel.xp.toLocaleString()}`, 240, statsY);
  ctx.fillText(`Nachrichten: ${userLevel.messages.toLocaleString()}`, 420, statsY);
  
  // Voice Zeit formatieren
  const hours = Math.floor(userLevel.voiceTime / 3600);
  const minutes = Math.floor((userLevel.voiceTime % 3600) / 60);
  ctx.fillText(`Voice Zeit: ${hours}h ${minutes}m`, 240, statsY + 25);

  // Rank (falls gewünscht)
  ctx.fillStyle = '#ffdd44';
  ctx.font = 'bold 20px Roboto, Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`Rank #?`, 740, 140);

  return canvas.toBuffer('image/png');
}

export async function createLeaderboardCard(users: any[], guildName: string): Promise<Buffer> {
  const canvas = createCanvas(1000, 600 + (users.length * 80));
  const ctx = canvas.getContext('2d');

  // Hintergrund
  const gradient = ctx.createLinearGradient(0, 0, 1000, canvas.height);
  gradient.addColorStop(0, '#2c3e50');
  gradient.addColorStop(1, '#34495e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, canvas.height);

  // Header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Roboto, Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`🏆 ${guildName} Leaderboard`, 500, 60);

  // Header Linie
  ctx.strokeStyle = '#3498db';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(100, 80);
  ctx.lineTo(900, 80);
  ctx.stroke();

  let yPos = 150;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const isTopThree = i < 3;

    // Rang Hintergrund
    if (isTopThree) {
      const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32']; // Gold, Silber, Bronze
      ctx.fillStyle = rankColors[i];
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    }
    
    ctx.fillRect(50, yPos - 40, 900, 70);

    // Rang Nummer
    ctx.fillStyle = isTopThree ? '#000000' : '#ffffff';
    ctx.font = 'bold 36px Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`#${i + 1}`, 100, yPos);

    // Avatar (vereinfacht als Kreis)
    ctx.fillStyle = '#36393f';
    ctx.beginPath();
    ctx.arc(180, yPos - 10, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(user.user.username[0].toUpperCase(), 180, yPos - 5);

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Roboto, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(user.user.username, 220, yPos - 10);

    // Level und XP
    ctx.font = '18px Roboto, Arial';
    ctx.fillText(`Level ${user.level}`, 220, yPos + 15);

    // XP (rechts)
    ctx.textAlign = 'right';
    ctx.fillText(`${user.xp.toLocaleString()} XP`, 920, yPos);

    yPos += 80;
  }

  return canvas.toBuffer('image/png');
}