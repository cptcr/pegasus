// src/commands/community/userinfo.ts - User Info Community Command
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember,
  ActivityType
} from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: 'userinfo',
  description: 'Display detailed information about a user',
  category: 'community',
  usage: '/userinfo [user]',
  examples: [
    '/userinfo',
    '/userinfo @user',
    '/userinfo user:JohnDoe'
  ],
  aliases: ['whois', 'ui'],
  cooldown: 5,
  guildOnly: false
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display detailed information about a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to get information about')
        .setRequired(false)),
  category: 'community',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild ? await interaction.guild.members.fetch(targetUser.id).catch(() => null) : null;

    const embed = new EmbedBuilder()
      .setTitle(`📋 User Information - ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setColor(member?.displayHexColor || Config.COLORS.PRIMARY)
      .setFooter({ 
        text: `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    // Basic user information
    const userFlags = targetUser.flags?.toArray() || [];
    const badges = formatUserBadges(userFlags);
    
    embed.addFields({
      name: '👤 Basic Information',
      value: [
        `**Username:** ${targetUser.username}`,
        `**Display Name:** ${targetUser.displayName}`,
        `**ID:** ${targetUser.id}`,
        `**Bot:** ${targetUser.bot ? 'Yes' : 'No'}`,
        `**System:** ${targetUser.system ? 'Yes' : 'No'}`,
        badges ? `**Badges:** ${badges}` : ''
      ].filter(Boolean).join('\n'),
      inline: true
    });

    // Account creation and timing info
    embed.addFields({
      name: '📅 Account Details',
      value: [
        `**Created:** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>`,
        `**Created:** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
        `**Avatar:** ${targetUser.avatar ? 'Custom' : 'Default'}`
      ].join('\n'),
      inline: true
    });

    // Server-specific information
    if (member && interaction.guild) {
      const roles = member.roles.cache
        .filter(role => role.id !== interaction.guild!.id)
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString())
        .slice(0, 10); // Limit to first 10 roles

      embed.addFields({
        name: '🏠 Server Information',
        value: [
          `**Nickname:** ${member.nickname || 'None'}`,
          `**Joined:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:F>`,
          `**Joined:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:R>`,
          `**Highest Role:** ${member.roles.highest.toString()}`,
          `**Role Count:** ${member.roles.cache.size - 1}`,
          `**Booster:** ${member.premiumSince ? `Since <t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>` : 'No'}`
        ].join('\n'),
        inline: false
      });

      if (roles.length > 0) {
        embed.addFields({
          name: `🎭 Roles (${member.roles.cache.size - 1})`,
          value: roles.join(' ') + (member.roles.cache.size > 11 ? ` and ${member.roles.cache.size - 11} more...` : ''),
          inline: false
        });
      }

      // Permissions (if user has administrative permissions)
      if (member.permissions.has(['Administrator', 'ManageGuild', 'ManageChannels'])) {
        const keyPerms = [];
        if (member.permissions.has('Administrator')) keyPerms.push('Administrator');
        if (member.permissions.has('ManageGuild')) keyPerms.push('Manage Server');
        if (member.permissions.has('ManageChannels')) keyPerms.push('Manage Channels');
        if (member.permissions.has('ManageMessages')) keyPerms.push('Manage Messages');
        if (member.permissions.has('KickMembers')) keyPerms.push('Kick Members');
        if (member.permissions.has('BanMembers')) keyPerms.push('Ban Members');

        if (keyPerms.length > 0) {
          embed.addFields({
            name: '🔐 Key Permissions',
            value: keyPerms.join(', '),
            inline: false
          });
        }
      }
    }

    // User presence and activity
    if (member?.presence) {
      const status = member.presence.status;
      const statusEmojis = {
        online: '🟢',
        idle: '🟡',
        dnd: '🔴',
        offline: '⚫',
        invisible: '⚫'
      };

      let presenceInfo = `**Status:** ${statusEmojis[status]} ${status.charAt(0).toUpperCase() + status.slice(1)}`;

      if (member.presence.activities.length > 0) {
        const activity = member.presence.activities[0];
        const activityType = ActivityType[activity.type];
        
        presenceInfo += `\n**Activity:** ${activityType} ${activity.name}`;
        
        if (activity.details) {
          presenceInfo += `\n**Details:** ${activity.details}`;
        }
        
        if (activity.state) {
          presenceInfo += `\n**State:** ${activity.state}`;
        }
      }

      embed.addFields({
        name: '🎮 Presence',
        value: presenceInfo,
        inline: true
      });
    }

    // Database stats (if available)
    if (interaction.guild) {
      try {
        const userLevel = await client.db.userLevel.findUnique({
          where: {
            userId_guildId: {
              userId: targetUser.id,
              guildId: interaction.guild.id
            }
          }
        });

        const warningCount = await client.db.warn.count({
          where: {
            userId: targetUser.id,
            guildId: interaction.guild.id,
            active: true
          }
        });

        if (userLevel || warningCount > 0) {
          const statsInfo = [];
          
          if (userLevel) {
            statsInfo.push(`**Level:** ${userLevel.level}`);
            statsInfo.push(`**XP:** ${userLevel.xp}`);
            statsInfo.push(`**Messages:** ${userLevel.messages}`);
            if (userLevel.voiceTime > 0) {
              const hours = Math.floor(userLevel.voiceTime / 3600);
              statsInfo.push(`**Voice Time:** ${hours}h`);
            }
          }
          
          if (warningCount > 0) {
            statsInfo.push(`**Warnings:** ${warningCount}`);
          }

          if (statsInfo.length > 0) {
            embed.addFields({
              name: '📊 Server Stats',
              value: statsInfo.join('\n'),
              inline: true
            });
          }
        }
      } catch (error) {
        client.logger.warn('Failed to fetch user stats:', error);
      }
    }

    // Acknowledgments section for special users
    const acknowledgments = [];
    if (targetUser.id === interaction.guild?.ownerId) {
      acknowledgments.push('👑 Server Owner');
    }
    if (targetUser.bot) {
      acknowledgments.push('🤖 Bot Account');
    }
    if (member?.premiumSince) {
      acknowledgments.push('💎 Server Booster');
    }
    if (targetUser.id === client.user?.id) {
      acknowledgments.push('🌟 That\'s me!');
    }

    if (acknowledgments.length > 0) {
      embed.addFields({
        name: '🏆 Acknowledgments',
        value: acknowledgments.join('\n'),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });

    // Log for community engagement stats
    if (interaction.guild) {
      client.wsManager.emitRealtimeEvent(interaction.guild.id, 'community:userinfo_viewed', {
        viewerId: interaction.user.id,
        targetId: targetUser.id,
        targetUsername: targetUser.username
      });
    }

    client.logger.debug(`${interaction.user.tag} viewed user info for ${targetUser.tag}`);
  }
};

function formatUserBadges(flags: string[]): string {
  const badgeEmojis: Record<string, string> = {
    'Staff': '👨‍💼',
    'Partner': '🤝',
    'Hypesquad': '🎉',
    'BugHunterLevel1': '🐛',
    'BugHunterLevel2': '🐛',
    'HypeSquadOnlineHouse1': '🏠',
    'HypeSquadOnlineHouse2': '🏠',
    'HypeSquadOnlineHouse3': '🏠',
    'PremiumEarlySupporter': '⭐',
    'TeamPseudoUser': '👥',
    'VerifiedBot': '✅',
    'VerifiedDeveloper': '👨‍💻',
    'CertifiedModerator': '🛡️',
    'BotHTTPInteractions': '🔗'
  };

  return flags
    .map(flag => `${badgeEmojis[flag] || '🏷️'} ${flag.replace(/([A-Z])/g, ' $1').trim()}`)
    .join('\n') || 'None';
}

export default command;