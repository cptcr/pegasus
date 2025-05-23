// src/events/messageCreate.ts (Enhanced with Real-time Dashboard Updates)
import { Message, EmbedBuilder } from 'discord.js';
import { DatabaseService } from '../lib/database';
import { client } from '../index';

// Cooldowns for XP gain (per user)
const xpCooldowns = new Map<string, number>();
const XP_COOLDOWN = 60000; // 1 minute
const XP_MIN = 15;
const XP_MAX = 25;

export async function handleMessageCreate(message: Message) {
  // Ignore bots and system messages
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  
  try {
    // Check if guild has leveling enabled
    const guild = await DatabaseService.getGuildSettings(guildId);
    if (!guild.enableLeveling) return;

    // Sync user to database
    await DatabaseService.syncUser(message.author);

    // Check XP cooldown
    const cooldownKey = `${userId}-${guildId}`;
    const lastXP = xpCooldowns.get(cooldownKey) || 0;
    const now = Date.now();
    
    if (now - lastXP < XP_COOLDOWN) return;

    // Add message count
    await DatabaseService.addMessage(userId, guildId);

    // Calculate XP gain
    const xpGain = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
    
    // Add XP and check for level up
    const { userLevel, leveledUp, oldLevel } = await DatabaseService.addXP(userId, guildId, xpGain);
    
    // Set cooldown
    xpCooldowns.set(cooldownKey, now);

    // Handle level up
    if (leveledUp) {
      await handleLevelUp(message, userLevel, oldLevel, guild);
    }

    // Emit real-time event for dashboard
    if (global.io) {
      global.io.to(`guild:${guildId}`).emit('activity:updated', {
        guildId,
        activity: {
          type: 'message',
          userId,
          username: message.author.username,
          xpGained: xpGain,
          newLevel: userLevel.level,
          leveledUp
        },
        timestamp: new Date().toISOString()
      });

      // Update guild stats every 10 messages
      if (Math.random() < 0.1) {
        const stats = await DatabaseService.getGuildStats(guildId);
        global.io.to(`guild:${guildId}`).emit('guild:stats:updated', {
          guildId,
          stats,
          timestamp: new Date().toISOString()
        });
      }
    }

  } catch (error) {
    console.error('Error handling message XP:', error);
  }
}

async function handleLevelUp(message: Message, userLevel: any, oldLevel: number, guild: any) {
  const newLevel = userLevel.level;
  
  try {
    // Check for level rewards
    const rewards = await DatabaseService.getLevelRewards(guild.id);
    const newReward = rewards.find(r => r.level === newLevel);
    
    // Create level up embed
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎉 Level Up!')
      .setDescription(`Congratulations ${message.author}! You've reached **Level ${newLevel}**!`)
      .addFields(
        { name: '📊 Previous Level', value: oldLevel.toString(), inline: true },
        { name: '📈 New Level', value: newLevel.toString(), inline: true },
        { name: '⭐ Total XP', value: userLevel.xp.toLocaleString(), inline: true }
      )
      .setThumbnail(message.author.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: `Guild: ${message.guild?.name}` });

    // Add reward info if applicable
    if (newReward) {
      try {
        const role = await message.guild?.roles.fetch(newReward.roleId);
        if (role) {
          embed.addFields({
            name: '🎁 Reward Unlocked!',
            value: `You've been given the **${role.name}** role!\n${newReward.description || ''}`,
            inline: false
          });

          // Give the role to the user
          const member = await message.guild?.members.fetch(message.author.id);
          if (member && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
          }
        }
      } catch (roleError) {
        console.error('Error handling level reward:', roleError);
      }
    }

    // Send level up message
    let channel = message.channel;
    
    // Use dedicated level up channel if configured
    if (guild.levelUpChannelId) {
      try {
        const levelUpChannel = await message.guild?.channels.fetch(guild.levelUpChannelId);
        if (levelUpChannel?.isTextBased()) {
          channel = levelUpChannel;
        }
      } catch (error) {
        // Fall back to current channel
      }
    }

    await channel.send({ embeds: [embed] });

    // Emit real-time event
    if (global.io) {
      global.io.to(`guild:${guild.id}`).emit('realtime:event', {
        type: 'level:updated',
        guildId: guild.id,
        data: {
          userId: message.author.id,
          username: message.author.username,
          oldLevel,
          newLevel,
          reward: newReward ? {
            roleId: newReward.roleId,
            description: newReward.description
          } : null
        },
        timestamp: new Date().toISOString()
      });
    }

    console.log(`✨ ${message.author.username} leveled up to ${newLevel} in ${message.guild?.name}`);

  } catch (error) {
    console.error('Error handling level up:', error);
  }
}

// Voice state update handler for voice time tracking
export async function handleVoiceStateUpdate(oldState: any, newState: any) {
  const userId = newState.id;
  const guildId = newState.guild.id;

  try {
    // Check if guild has leveling enabled
    const guild = await DatabaseService.getGuildSettings(guildId);
    if (!guild.enableLeveling) return;

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
      // Store join time
      const userLevel = await DatabaseService.getUserLevel(userId, guildId);
      await DatabaseService.prisma.userLevel.update({
        where: {
          userId_guildId: { userId, guildId }
        },
        data: {
          lastVoiceJoin: new Date()
        }
      });
    }
    
    // User left a voice channel
    else if (oldState.channelId && !newState.channelId) {
      const userLevel = await DatabaseService.getUserLevel(userId, guildId);
      
      if (userLevel.lastVoiceJoin) {
        const timeSpent = Math.floor((Date.now() - userLevel.lastVoiceJoin.getTime()) / 1000);
        
        // Only count if they were in voice for at least 1 minute
        if (timeSpent >= 60) {
          await DatabaseService.addVoiceTime(userId, guildId, timeSpent);
          
          // Give XP for voice time (1 XP per minute)
          const voiceXP = Math.floor(timeSpent / 60);
          if (voiceXP > 0) {
            const { userLevel: updatedLevel, leveledUp, oldLevel } = await DatabaseService.addXP(userId, guildId, voiceXP);
            
            // Handle level up from voice time
            if (leveledUp) {
              const user = await client.users.fetch(userId);
              const fakeMessage = {
                author: user,
                guild: newState.guild,
                channel: newState.guild.systemChannel || newState.guild.channels.cache.find((c: any) => c.type === 0)
              };
              
              if (fakeMessage.channel) {
                await handleLevelUp(fakeMessage as any, updatedLevel, oldLevel, guild);
              }
            }

            // Emit real-time event
            if (global.io) {
              global.io.to(`guild:${guildId}`).emit('activity:updated', {
                guildId,
                activity: {
                  type: 'voice',
                  userId,
                  username: userLevel.user.username,
                  timeSpent,
                  xpGained: voiceXP
                },
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('Error handling voice state update:', error);
  }
}

// Guild member add handler
export async function handleGuildMemberAdd(member: any) {
  const guildId = member.guild.id;
  const userId = member.user.id;

  try {
    // Sync user and create level entry
    await DatabaseService.syncUser(member.user);
    await DatabaseService.getUserLevel(userId, guildId);

    // Get guild settings for welcome message
    const guild = await DatabaseService.getGuildSettings(guildId);
    
    if (guild.welcomeChannelId && guild.welcomeMessage) {
      try {
        const welcomeChannel = await member.guild.channels.fetch(guild.welcomeChannelId);
        if (welcomeChannel?.isTextBased()) {
          const welcomeText = guild.welcomeMessage
            .replace(/{user}/g, member.user.toString())
            .replace(/{server}/g, member.guild.name)
            .replace(/{membercount}/g, member.guild.memberCount.toString());

          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('👋 Welcome!')
            .setDescription(welcomeText)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Member #${member.guild.memberCount}` });

          await welcomeChannel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error('Error sending welcome message:', error);
      }
    }

    // Emit real-time event
    if (global.io) {
      global.io.to(`guild:${guildId}`).emit('realtime:event', {
        type: 'member:joined',
        guildId,
        data: {
          userId,
          username: member.user.username,
          memberCount: member.guild.memberCount
        },
        timestamp: new Date().toISOString()
      });

      // Update guild stats
      const stats = await DatabaseService.getGuildStats(guildId);
      global.io.to(`guild:${guildId}`).emit('guild:stats:updated', {
        guildId,
        stats,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error handling guild member add:', error);
  }
}

// Guild member remove handler
export async function handleGuildMemberRemove(member: any) {
  const guildId = member.guild.id;
  const userId = member.user.id;

  try {
    // Get guild settings for leave message
    const guild = await DatabaseService.getGuildSettings(guildId);
    
    if (guild.welcomeChannelId && guild.leaveMessage) {
      try {
        const leaveChannel = await member.guild.channels.fetch(guild.welcomeChannelId);
        if (leaveChannel?.isTextBased()) {
          const leaveText = guild.leaveMessage
            .replace(/{user}/g, member.user.username)
            .replace(/{server}/g, member.guild.name);

          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('👋 Goodbye!')
            .setDescription(leaveText)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Members remaining: ${member.guild.memberCount}` });

          await leaveChannel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error('Error sending leave message:', error);
      }
    }

    // Emit real-time event
    if (global.io) {
      global.io.to(`guild:${guildId}`).emit('realtime:event', {
        type: 'member:left',
        guildId,
        data: {
          userId,
          username: member.user.username,
          memberCount: member.guild.memberCount
        },
        timestamp: new Date().toISOString()
      });

      // Update guild stats
      const stats = await DatabaseService.getGuildStats(guildId);
      global.io.to(`guild:${guildId}`).emit('guild:stats:updated', {
        guildId,
        stats,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error handling guild member remove:', error);
  }
}