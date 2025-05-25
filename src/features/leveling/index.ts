import { ClientWithCommands, Feature } from '../../types';
import { Events, VoiceState, Message } from 'discord.js';
import { getGuildSettings, updateGuildSettings, invalidateGuildSettingsCache } from '../../utils/guildSettings';

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
      if (message.author.bot || !message.guild) return;

      const guildSettings = await getGuildSettings(message.guild.id, client);
      if (!guildSettings.enableLeveling) return;

      const userId = message.author.id;
      const guildId = message.guild.id;

      try {
        const xpToAdd = Math.floor(Math.random() * 10) + 15; // 15-24 XP pro Nachricht

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

          if (guildSettings.levelUpChannelId) {
            const channel = message.guild.channels.cache.get(guildSettings.levelUpChannelId);
            if (channel && channel.isTextBased()) {
              await channel.send(`🎉 Herzlichen Glückwunsch ${message.author.toString()}, du hast Level ${newLevel} erreicht!`);
            }
          } else {
             message.channel.send(`🎉 Herzlichen Glückwunsch ${message.author.toString()}, du hast Level ${newLevel} erreicht!`).catch(console.error);
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
                if (guildSettings.levelUpChannelId) {
                    const channel = message.guild.channels.cache.get(guildSettings.levelUpChannelId);
                    if (channel && channel.isTextBased()) {
                       await channel.send(`🏅 ${message.author.toString()} hat die Rolle **${role.name}** für das Erreichen von Level ${newLevel} erhalten!`);
                    }
                } else {
                    message.channel.send(`🏅 ${message.author.toString()} hat die Rolle **${role.name}** für das Erreichen von Level ${newLevel} erhalten!`).catch(console.error);
                }
              }
            } catch (roleError) {
              console.error(`Fehler beim Zuweisen der Level-Belohnung Rolle ${reward.roleId} an Benutzer ${userId}:`, roleError);
            }
          }
        }
      } catch (error) {
        console.error(`Fehler beim Aktualisieren des User-Levels für ${userId} in Gilde ${guildId}:`, error);
      }
    });

    client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
      if (newState.member?.user.bot || !newState.guild) return;

      const guildSettings = await getGuildSettings(newState.guild.id, client);
      if (!guildSettings.enableLeveling) return;

      const userId = newState.member!.id;
      const guildId = newState.guild.id;

      if (oldState.channelId === null && newState.channelId !== null) {
        if (!newState.serverMute && !newState.serverDeaf) {
          voiceTimeMap.set(userId, { guildId, channelId: newState.channelId, joinedAt: Date.now() });
        }
      } else if (oldState.channelId !== null && newState.channelId === null) {
        const entry = voiceTimeMap.get(userId);
        if (entry && entry.guildId === guildId && entry.channelId === oldState.channelId) {
          const durationSeconds = Math.floor((Date.now() - entry.joinedAt) / 1000);
          voiceTimeMap.delete(userId);

          if (durationSeconds > 0) {
            const xpToAdd = Math.floor(durationSeconds / 60) * 5; // 5 XP pro Minute
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
        }
      } else if (oldState.channelId !== null && newState.channelId !== null && oldState.channelId !== newState.channelId) {
        const entry = voiceTimeMap.get(userId);
        if (entry && entry.guildId === guildId && entry.channelId === oldState.channelId) {
            const durationSeconds = Math.floor((Date.now() - entry.joinedAt) / 1000);
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
                        console.error(`Fehler beim Aktualisieren der Sprachzeit (Kanalwechsel) für ${userId}:`, error);
                    }
                }
            }
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
                                console.error(`Fehler beim Aktualisieren der Sprachzeit (Mute/Deaf) für ${userId}:`, error);
                            }
                        }
                   }
              }
          } else {
              if (!entry) {
                  voiceTimeMap.set(userId, { guildId, channelId: newState.channelId, joinedAt: Date.now() });
              }
          }
      }
    });
  },
};

export default levelingFeature;