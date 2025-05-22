import { Events, Message, VoiceState, EmbedBuilder, TextChannel } from 'discord.js';
import { DatabaseService } from '../lib/database';
import { createLevelCard } from '../utils/levelCard';

const messageCooldowns = new Map<string, number>();
const voiceJoinTimes = new Map<string, number>();

// Message XP Event
export const messageCreate = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    // Ignore bots und System-Nachrichten
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const guildId = message.guild.id;
    const now = Date.now();

    // Cooldown prüfen (60 Sekunden zwischen XP-Vergabe)
    const cooldownKey = `${userId}-${guildId}`;
    const lastMessage = messageCooldowns.get(cooldownKey);
    if (lastMessage && now - lastMessage < 60000) {
      return;
    }

    messageCooldowns.set(cooldownKey, now);

    try {
      // Prüfe Guild-Einstellungen
      const guildSettings = await DatabaseService.getGuildSettings(guildId);
      if (!guildSettings.enableLeveling) return;

      // User erstellen/aktualisieren
      await DatabaseService.getOrCreateUser(userId, message.author.username);

      // Message count erhöhen
      await DatabaseService.addMessage(userId, guildId);

      // XP hinzufügen (15-25 XP pro Nachricht)
      const xpToAdd = Math.floor(Math.random() * 11) + 15;
      const result = await DatabaseService.addXP(userId, guildId, xpToAdd);

      // Level Up Event
      if (result.leveledUp) {
        await handleLevelUp(message, result.userLevel, result.oldLevel, guildSettings.levelUpChannelId);
      }

    } catch (error) {
      console.error('Fehler beim Verarbeiten von Message XP:', error);
    }
  },
};

// Voice Channel Events
export const voiceStateUpdate = {
  name: Events.VoiceStateUpdate,
  async execute(oldState: VoiceState, newState: VoiceState) {
    const userId = newState.member?.id;
    const guildId = newState.guild.id;
    
    if (!userId) return;

    try {
      const guildSettings = await DatabaseService.getGuildSettings(guildId);
      if (!guildSettings.enableLeveling) return;

      const voiceKey = `${userId}-${guildId}`;

      // User joined voice channel
      if (!oldState.channel && newState.channel) {
        voiceJoinTimes.set(voiceKey, Date.now());
      }
      
      // User left voice channel
      else if (oldState.channel && !newState.channel) {
        const joinTime = voiceJoinTimes.get(voiceKey);
        if (joinTime) {
          const timeSpent = Math.floor((Date.now() - joinTime) / 1000); // in Sekunden
          
          if (timeSpent > 60) { // Mindestens 1 Minute
            // User erstellen/aktualisieren
            await DatabaseService.getOrCreateUser(userId, newState.member.user.username);
            
            // Voice time hinzufügen
            await DatabaseService.addVoiceTime(userId, guildId, timeSpent);
            
            // XP für Voice-Zeit (1 XP pro Minute)
            const voiceXP = Math.floor(timeSpent / 60);
            if (voiceXP > 0) {
              const result = await DatabaseService.addXP(userId, guildId, voiceXP);
              
              // Level Up prüfen
              if (result.leveledUp) {
                const member = newState.member;
                if (member) {
                  // Fake message object für Level Up
                  const fakeMessage = {
                    author: member.user,
                    guild: newState.guild,
                    channel: null,
                  } as any;
                  
                  await handleLevelUp(fakeMessage, result.userLevel, result.oldLevel, guildSettings.levelUpChannelId);
                }
              }
            }
          }
          
          voiceJoinTimes.delete(voiceKey);
        }
      }
      
      // User switched channels
      else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        const joinTime = voiceJoinTimes.get(voiceKey);
        if (joinTime) {
          // Zeit für alten Channel berechnen
          const timeSpent = Math.floor((Date.now() - joinTime) / 1000);
          
          if (timeSpent > 60) {
            await DatabaseService.getOrCreateUser(userId, newState.member.user.username);
            await DatabaseService.addVoiceTime(userId, guildId, timeSpent);
            
            const voiceXP = Math.floor(timeSpent / 60);
            if (voiceXP > 0) {
              await DatabaseService.addXP(userId, guildId, voiceXP);
            }
          }
        }
        
        // Neue Zeit für neuen Channel setzen
        voiceJoinTimes.set(voiceKey, Date.now());
      }

    } catch (error) {
      console.error('Fehler beim Verarbeiten von Voice XP:', error);
    }
  },
};

async function handleLevelUp(message: any, userLevel: any, oldLevel: number, levelUpChannelId?: string) {
  try {
    // Level rewards prüfen
    const rewards = await DatabaseService.getLevelRewards(message.guild.id);
    const newReward = rewards.find(r => r.level === userLevel.level);

    // Level Card erstellen
    const levelCard = await createLevelCard(userLevel, message.author);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎉 Level Up!')
      .setDescription(`Glückwunsch ${message.author}! Du bist auf **Level ${userLevel.level}** aufgestiegen!`)
      .addFields(
        { name: 'Vorheriges Level', value: oldLevel.toString(), inline: true },
        { name: 'Neues Level', value: userLevel.level.toString(), inline: true },
        { name: 'Gesamt XP', value: userLevel.xp.toString(), inline: true }
      )
      .setImage('attachment://level-card.png')
      .setTimestamp();

    // Neue Rolle hinzufügen
    if (newReward) {
      try {
        const member = await message.guild.members.fetch(message.author.id);
        const role = await message.guild.roles.fetch(newReward.roleId);
        
        if (role && member) {
          await member.roles.add(role);
          embed.addFields({
            name: '🎁 Neue Rolle erhalten!',
            value: `${role} - ${newReward.description || 'Level Belohnung'}`,
            inline: false
          });
        }
      } catch (error) {
        console.error('Fehler beim Hinzufügen der Level-Rolle:', error);
      }
    }

    // Channel für Level Up Nachrichten
    let targetChannel: TextChannel | null = null;
    
    if (levelUpChannelId) {
      targetChannel = await message.guild.channels.fetch(levelUpChannelId).catch(() => null) as TextChannel;
    }
    
    if (!targetChannel && message.channel) {
      targetChannel = message.channel;
    }

    if (targetChannel) {
      await targetChannel.send({
        embeds: [embed],
        files: [{
          attachment: levelCard,
          name: 'level-card.png'
        }]
      });
    }

  } catch (error) {
    console.error('Fehler beim Level Up:', error);
  }
}