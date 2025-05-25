import { ClientWithCommands, Feature } from '../../types';
import { Events, VoiceState, Message, TextChannel } from 'discord.js';
import { getGuildSettings } from '../../utils/guildSettings';

const voiceTimeMap = new Map<string, { guildId: string, channelId: string, joinedAt: number }>();

const levelingFeature: Feature = {
  name: 'leveling',
  description: 'Verwaltet das XP- und Levelsystem für Benutzer basierend auf Nachrichten- und Sprachaktivität.',
  enabled: true,
  async initialize(client: ClientWithCommands) {
    if (!client.config.enabledFeatures.leveling) {
      return;
    }

    client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot || !message.guild || !message.guildId) return;

      const guildSettings = await getGuildSettings(message.guild.id, client);
      if (!guildSettings.enableLeveling) return;

      const userId = message.author.id;
      const guildId = message.guild.id;

      try {
        const xpToAdd = Math.floor(Math.random() * 10) + 15;

        const userLevel = await client.prisma.userLevel.upsert({
          where: { userId_guildId: { userId, guildId } },
          update: {
            xp: { increment: xpToAdd },
            messages: { increment: 1 },
          },
          create: {
            userId,
            guildId,
            username: message.author.username,
            xp: xpToAdd,
            messages: 1,
            level: 0,
            voiceTime: 0,
          },
        });

        const xpForNextLevel = (userLevel.level + 1) * (userLevel.level + 1) * 100;
        if (userLevel.xp >= xpForNextLevel) {
          const newLevel = userLevel.level + 1;
          await client.prisma.userLevel.update({
            where: { userId_guildId: { userId, guildId } },
            data: { level: newLevel },
          });

          const levelUpMessage = `🎉 Herzlichen Glückwunsch ${message.author.toString()}, du hast Level **${newLevel}** erreicht!`;
          let repliedInLevelUpChannel = false;

          if (guildSettings.levelUpChannelId) {
            const channel = message.guild.channels.cache.get(guildSettings.levelUpChannelId) as TextChannel | undefined;
            if (channel && channel.isTextBased()) {
              await channel.send(levelUpMessage).catch(console.error);
              repliedInLevelUpChannel = true;
            }
          }
          if (!repliedInLevelUpChannel) {
             message.channel.send(levelUpMessage).catch(console.error);
          }

          const rewards = await client.prisma.levelReward.findMany({
            where: { guildId, level: newLevel }
          });

          for (const reward of rewards) {
            try {
              const member = await message.guild.members.fetch(userId);
              const role = message.guild.roles.cache.get(reward.roleId);
              if (member && role) {
                await member.roles.add(role);
                const rewardMessage = `🏅 ${message.author.toString()} hat die Rolle **${role.name}** für das Erreichen von Level ${newLevel} erhalten!`;
                if (guildSettings.levelUpChannelId && repliedInLevelUpChannel) {
                    const channel = message.guild.channels.cache.get(guildSettings.levelUpChannelId) as TextChannel | undefined;
                    if (channel && channel.isTextBased()) {
                       await channel.send(rewardMessage).catch(console.error);
                    }
                } else {
                    message.channel.send(rewardMessage).catch(console.error);
                }
              }
            } catch (roleError) {
              console.error(`Fehler beim Zuweisen der Level-Belohnungsrolle ${reward.roleId} an Benutzer ${userId}:`, roleError);
            }
          }
        }
      } catch (error) {
        console.error(`Fehler beim Aktualisieren des User-Levels für ${userId} in Gilde ${guildId}:`, error);
      }
    });

    client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
      if (newState.member?.user.bot || !newState.guild || !newState.guildId) return;

      const guildSettings = await getGuildSettings(newState.guild.id, client);
      if (!guildSettings.enableLeveling) return;

      const userId = newState.member!.id;
      const guildId = newState.guild.id;

      const processVoiceXP = async (durationSeconds: number) => {
        if (durationSeconds > 0) {
          const xpToAdd = Math.floor(durationSeconds / 60) * 5;
          if (xpToAdd > 0) {
            try {
              await client.prisma.userLevel.upsert({
                where: { userId_guildId: { userId, guildId } },
                update: {
                  xp: { increment: xpToAdd },
                  voiceTime: { increment: durationSeconds },
                },
                create: {
                  userId,
                  guildId,
                  username: newState.member!.user.username,
                  xp: xpToAdd,
                  messages: 0,
                  level: 0,
                  voiceTime: durationSeconds,
                },
              });
            } catch (error) {
               console.error(`Fehler beim Aktualisieren der Sprachzeit für ${userId}:`, error);
            }
          }
        }
      };

      if (oldState.channelId === null && newState.channelId !== null) {
        if (!newState.serverMute && !newState.serverDeaf) {
          voiceTimeMap.set(userId, { guildId, channelId: newState.channelId, joinedAt: Date.now() });
        }
      } else if (oldState.channelId !== null && newState.channelId === null) {
        const entry = voiceTimeMap.get(userId);
        if (entry && entry.guildId === guildId && entry.channelId === oldState.channelId) {
          const durationSeconds = Math.floor((Date.now() - entry.joinedAt) / 1000);
          voiceTimeMap.delete(userId);
          await processVoiceXP(durationSeconds);
        }
      } else if (oldState.channelId !== null && newState.channelId !== null && oldState.channelId !== newState.channelId) {
        const entry = voiceTimeMap.get(userId);
        if (entry && entry.guildId === guildId && entry.channelId === oldState.channelId) {
            const durationSeconds = Math.floor((Date.now() - entry.joinedAt) / 1000);
            await processVoiceXP(durationSeconds);
        }
        if (!newState.serverMute && !newState.serverDeaf) {
            voiceTimeMap.set(userId, { guildId, channelId: newState.channelId, joinedAt: Date.now() });
        } else {
            voiceTimeMap.delete(userId);
        }
      } else if (newState.channelId !== null) {
          const entry = voiceTimeMap.get(userId);
          if (newState.serverMute || newState.serverDeaf) {
              if (entry) {
                  const durationSeconds = Math.floor((Date.now() - entry.joinedAt) / 1000);
                  voiceTimeMap.delete(userId);
                  await processVoiceXP(durationSeconds);
              }
          } else {
              if (!entry) {
                  voiceTimeMap.set(userId, { guildId, channelId: newState.channelId, joinedAt: Date.now() });
              }
          }
      }
    });
  },
  async shutdown(client: ClientWithCommands) {
    voiceTimeMap.forEach(async (value, key) => {
        const durationSeconds = Math.floor((Date.now() - value.joinedAt) / 1000);
        if (durationSeconds > 0) {
            const xpToAdd = Math.floor(durationSeconds / 60) * 5;
            if (xpToAdd > 0) {
                try {
                    await client.prisma.userLevel.upsert({
                        where: { userId_guildId: { userId: key, guildId: value.guildId } },
                        update: { xp: { increment: xpToAdd }, voiceTime: { increment: durationSeconds } },
                        create: {
                            userId: key,
                            guildId: value.guildId,
                            username: client.users.cache.get(key)?.username || 'Unbekannt',
                            xp: xpToAdd,
                            messages: 0,
                            level: 0,
                            voiceTime: durationSeconds
                        }
                    });
                } catch (e) {
                    console.error("Fehler beim Speichern der restlichen Voice-XP beim Herunterfahren:", e);
                }
            }
        }
    });
    voiceTimeMap.clear();
  }
};

export default levelingFeature;