import { SlashCommandBuilder, GuildMember, EmbedBuilder, User, UserFlagsBitField } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, formatTimeAgo } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis, colors } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Get comprehensive information about a user')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to get information about')
      .setRequired(false)
  )
  .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  const targetUser = interaction.options.getUser('user') || interaction.user;

  try {
    await interaction.deferReply();

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const user = await interaction.client.users.fetch(targetUser.id, { force: true });

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.user} User Information`)
      .setColor(member?.displayHexColor || colors.primary)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    // Basic Information
    embed.addFields({
      name: '👤 Basic Information',
      value: [
        `**Username:** ${user.username}`,
        `**Display Name:** ${user.displayName}`,
        `**User ID:** \`${user.id}\``,
        `**Bot:** ${user.bot ? 'Yes' : 'No'}`,
        `**System:** ${user.system ? 'Yes' : 'No'}`
      ].join('\n'),
      inline: true
    });

    // Account Information
    const accountAge = Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24));
    embed.addFields({
      name: '📅 Account Information',
      value: [
        `**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
        `**Account Age:** ${accountAge} days`,
        `**Created:** ${formatTimeAgo(user.createdAt)}`
      ].join('\n'),
      inline: true
    });

    // User Flags/Badges
    const flags = user.flags?.toArray() || [];
    const flagEmojis: { [key: string]: string } = {
      Staff: emojis.staff || '👨‍💼',
      Partner: emojis.partner || '🤝',
      Hypesquad: emojis.hypesquad || '🎉',
      BugHunterLevel1: emojis.bug || '🐛',
      BugHunterLevel2: emojis.bug || '🐛',
      HypesquadOnlineHouse1: '🏠',
      HypesquadOnlineHouse2: '🏠',
      HypesquadOnlineHouse3: '🏠',
      PremiumEarlySupporter: emojis.early || '⭐',
      VerifiedBot: emojis.verified || '✅',
      VerifiedDeveloper: '👨‍💻',
      CertifiedModerator: emojis.mod || '🛡️',
      BotHTTPInteractions: '🔗',
      ActiveDeveloper: '⚡'
    };

    if (flags.length > 0) {
      const flagList = flags.map(flag => `${flagEmojis[flag] || '🏷️'} ${flag.replace(/([A-Z])/g, ' $1').trim()}`).join('\n');
      embed.addFields({
        name: '🏆 Badges',
        value: flagList,
        inline: true
      });
    }

    // Server-specific information (if member exists)
    if (member) {
      const joinAge = Math.floor((Date.now() - member.joinedTimestamp!) / (1000 * 60 * 60 * 24));
      embed.addFields({
        name: '🏰 Server Information',
        value: [
          `**Joined:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:F>`,
          `**Join Age:** ${joinAge} days`,
          `**Nickname:** ${member.nickname || 'None'}`,
          `**Highest Role:** ${member.roles.highest}`,
          `**Role Count:** ${member.roles.cache.size - 1}`
        ].join('\n'),
        inline: false
      });

      // Roles (top 10)
      const roles = member.roles.cache
        .filter(role => role.id !== interaction.guild.roles.everyone.id)
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString())
        .slice(0, 10);

      if (roles.length > 0) {
        embed.addFields({
          name: `🎭 Roles [${member.roles.cache.size - 1}]`,
          value: roles.join(', ') + (member.roles.cache.size > 11 ? '\n*...and more*' : ''),
          inline: false
        });
      }

      // Status and Activity
      const presence = member.presence;
      const statusEmojis: { [key: string]: string } = {
        online: emojis.online || '🟢',
        idle: emojis.idle || '🟡',
        dnd: emojis.dnd || '🔴',
        offline: emojis.offline || '⚫'
      };

      const status = presence?.status || 'offline';
      let statusInfo = `**Status:** ${statusEmojis[status]} ${status.charAt(0).toUpperCase() + status.slice(1)}`;

      if (presence?.clientStatus) {
        const devices = [];
        if (presence.clientStatus.desktop) devices.push('🖥️ Desktop');
        if (presence.clientStatus.mobile) devices.push('📱 Mobile');
        if (presence.clientStatus.web) devices.push('🌐 Web');
        if (devices.length > 0) {
          statusInfo += `\n**Devices:** ${devices.join(', ')}`;
        }
      }

      if (presence?.activities && presence.activities.length > 0) {
        const activity = presence.activities[0];
        const activityTypes: { [key: number]: string } = {
          0: 'Playing',
          1: 'Streaming',
          2: 'Listening to',
          3: 'Watching',
          5: 'Competing in'
        };
        statusInfo += `\n**Activity:** ${activityTypes[activity.type] || 'Unknown'} ${activity.name}`;
      }

      embed.addFields({
        name: '📊 Status',
        value: statusInfo,
        inline: true
      });

      // Permissions
      const keyPermissions = [
        'Administrator',
        'ManageGuild',
        'ManageRoles',
        'ManageChannels',
        'KickMembers',
        'BanMembers',
        'ManageMessages',
        'MentionEveryone',
        'ViewAuditLog',
        'ManageWebhooks'
      ];

      const userPermissions = keyPermissions.filter(perm => 
        member.permissions.has(perm as any)
      );

      if (userPermissions.length > 0) {
        embed.addFields({
          name: '🔐 Key Permissions',
          value: userPermissions.map(perm => `• ${perm.replace(/([A-Z])/g, ' $1').trim()}`).join('\n'),
          inline: true
        });
      }
    }

    // Database statistics
    try {
      const stats = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM mod_actions WHERE user_id = $1 AND guild_id = $2) as mod_actions,
          (SELECT COUNT(*) FROM warnings WHERE user_id = $1 AND guild_id = $2 AND active = true) as warnings,
          (SELECT level FROM user_levels WHERE user_id = $1 AND guild_id = $2) as level,
          (SELECT xp FROM user_levels WHERE user_id = $1 AND guild_id = $2) as xp,
          (SELECT balance FROM user_economy WHERE user_id = $1 AND guild_id = $2) as balance
      `, [user.id, interaction.guild.id]);

      if (stats.rows[0]) {
        const dbStats = stats.rows[0];
        const statsText = [
          `**Warnings:** ${dbStats.warnings || 0}`,
          `**Mod Actions:** ${dbStats.mod_actions || 0}`,
          dbStats.level ? `**Level:** ${dbStats.level} (${dbStats.xp || 0} XP)` : null,
          dbStats.balance ? `**Balance:** $${dbStats.balance}` : null
        ].filter(Boolean).join('\n');

        if (statsText) {
          embed.addFields({
            name: '📈 Server Statistics',
            value: statsText,
            inline: true
          });
        }
      }
    } catch (error) {
      console.log('Error fetching user statistics:', error);
    }

    // Avatar information
    const avatarInfo = [
      `[Avatar URL](${user.displayAvatarURL({ size: 1024 })})`
    ];

    if (user.avatar !== user.defaultAvatarURL) {
      avatarInfo.push(`[Default Avatar](${user.defaultAvatarURL})`);
    }

    if (member?.avatar) {
      avatarInfo.push(`[Server Avatar](${member.displayAvatarURL({ size: 1024 })})`);
    }

    embed.addFields({
      name: '🖼️ Avatar',
      value: avatarInfo.join(' • '),
      inline: false
    });

    // Set footer with additional info
    embed.setFooter({
      text: `Requested by ${interaction.user.username} • User ID: ${user.id}`,
      iconURL: interaction.user.displayAvatarURL()
    });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error fetching user info:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to fetch user information. Please try again.')],
    });
  }
}