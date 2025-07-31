import { SlashCommandBuilder, EmbedBuilder, GuildMember, User } from 'discord.js';
import { createErrorEmbed, formatTimeAgo, getPermissionLevel } from '../../utils/helpers';
import { db } from '../../database/connection';
import { emojis, colors } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('whois')
  .setDescription('Get comprehensive information about a user with moderation history')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to look up')
      .setRequired(true)
  )
  .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  const targetUser = interaction.options.getUser('user', true);

  try {
    await interaction.deferReply();

    const user = await interaction.client.users.fetch(targetUser.id, { force: true });
    let member: GuildMember | null = null;

    try {
      member = await interaction.guild.members.fetch(targetUser.id);
    } catch (error) {
      // User is not in the guild
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.search} Who is ${user.username}?`)
      .setColor(member?.displayHexColor || colors.primary)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    // Basic User Information
    embed.addFields({
      name: '👤 User Information',
      value: [
        `**Username:** ${user.username}`,
        `**Display Name:** ${user.displayName}`,
        `**User ID:** \`${user.id}\``,
        `**Account Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
        `**Account Age:** ${formatTimeAgo(user.createdAt)}`,
        `**Bot Account:** ${user.bot ? 'Yes' : 'No'}`
      ].join('\n'),
      inline: true
    });

    // Server Information (if member)
    if (member) {
      const joinAge = Math.floor((Date.now() - member.joinedTimestamp!) / (1000 * 60 * 60 * 24));
      const permLevel = getPermissionLevel(member);
      const permLevels = ['User', 'Helper', 'Moderator', 'Administrator', 'Owner'];

      embed.addFields({
        name: '🏰 Server Information',
        value: [
          `**Joined Server:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:F>`,
          `**Join Age:** ${joinAge} days`,
          `**Nickname:** ${member.nickname || 'None'}`,
          `**Permission Level:** ${permLevels[permLevel]}`,
          `**Highest Role:** ${member.roles.highest}`,
          `**Total Roles:** ${member.roles.cache.size - 1}`
        ].join('\n'),
        inline: true
      });

      // Current Status
      const presence = member.presence;
      const statusEmojis: { [key: string]: string } = {
        online: emojis.online || '🟢',
        idle: emojis.idle || '🟡',
        dnd: emojis.dnd || '🔴',
        offline: emojis.offline || '⚫'
      };

      let statusInfo = `**Status:** ${statusEmojis[presence?.status || 'offline']} ${(presence?.status || 'offline').charAt(0).toUpperCase() + (presence?.status || 'offline').slice(1)}`;

      if (presence?.activities && presence.activities.length > 0) {
        const activity = presence.activities[0];
        statusInfo += `\n**Activity:** ${activity.name}`;
      }

      embed.addFields({
        name: '📊 Current Status',
        value: statusInfo,
        inline: true
      });
    } else {
      embed.addFields({
        name: '🏰 Server Information',
        value: '❌ **Not a member of this server**',
        inline: true
      });
    }

    // Moderation History
    try {
      const modActions = await db.query(`
        SELECT action, reason, created_at, moderator_id 
        FROM mod_actions 
        WHERE user_id = $1 AND guild_id = $2 
        ORDER BY created_at DESC 
        LIMIT 10
      `, [user.id, interaction.guild.id]);

      const warnings = await db.query(
        'SELECT COUNT(*) as count FROM warnings WHERE user_id = $1 AND guild_id = $2 AND active = true',
        [user.id, interaction.guild.id]
      );

      if (modActions.rows.length > 0 || warnings.rows[0]?.count > 0) {
        const actionCounts: { [key: string]: number } = {};
        modActions.rows.forEach((action: any) => {
          actionCounts[action.action] = (actionCounts[action.action] || 0) + 1;
        });

        const actionSummary = Object.entries(actionCounts)
          .map(([action, count]) => `**${action}:** ${count}`)
          .join('\n');

        const recentActions = modActions.rows.slice(0, 5).map((action: any) => {
          return `• **${action.action}** - ${formatTimeAgo(action.created_at)}`;
        }).join('\n');

        embed.addFields({
          name: '⚠️ Moderation History',
          value: [
            `**Active Warnings:** ${warnings.rows[0]?.count || 0}`,
            `**Total Actions:** ${modActions.rows.length}`,
            '',
            actionSummary
          ].join('\n'),
          inline: false
        });

        if (recentActions) {
          embed.addFields({
            name: '📜 Recent Actions',
            value: recentActions,
            inline: false
          });
        }
      } else {
        embed.addFields({
          name: '✅ Moderation History',
          value: 'No moderation actions on record',
          inline: false
        });
      }
    } catch (error) {
      console.log('Error fetching moderation history:', error);
    }

    // Server Statistics (if member)
    if (member) {
      try {
        const stats = await db.query(`
          SELECT 
            (SELECT level FROM user_levels WHERE user_id = $1 AND guild_id = $2) as level,
            (SELECT xp FROM user_levels WHERE user_id = $1 AND guild_id = $2) as xp,
            (SELECT balance FROM user_economy WHERE user_id = $1 AND guild_id = $2) as balance,
            (SELECT COUNT(*) FROM user_afk WHERE user_id = $1 AND guild_id = $2) as is_afk
        `, [user.id, interaction.guild.id]);

        if (stats.rows[0]) {
          const userStats = stats.rows[0];
          const statsInfo = [];

          if (userStats.level) statsInfo.push(`**Level:** ${userStats.level}`);
          if (userStats.xp) statsInfo.push(`**XP:** ${userStats.xp}`);  
          if (userStats.balance) statsInfo.push(`**Balance:** $${userStats.balance}`);
          if (userStats.is_afk > 0) statsInfo.push(`**Status:** AFK`);

          if (statsInfo.length > 0) {
            embed.addFields({
              name: '📈 Server Statistics',
              value: statsInfo.join('\n'),
              inline: true
            });
          }
        }
      } catch (error) {
        console.log('Error fetching user statistics:', error);
      }
    }

    // User Flags/Badges
    const flags = user.flags?.toArray() || [];
    if (flags.length > 0) {
      const flagEmojis: { [key: string]: string } = {
        Staff: emojis.staff || '👨‍💼',
        Partner: emojis.partner || '🤝',
        Hypesquad: emojis.hypesquad || '🎉',
        BugHunterLevel1: emojis.bug || '🐛',
        BugHunterLevel2: emojis.bug || '🔥🐛',
        PremiumEarlySupporter: emojis.early || '⭐',
        VerifiedBot: emojis.verified || '✅',
        VerifiedDeveloper: '👨‍💻',
        CertifiedModerator: emojis.mod || '🛡️'
      };

      const flagList = flags.map(flag => 
        `${flagEmojis[flag] || '🏷️'} ${flag.replace(/([A-Z])/g, ' $1').trim()}`
      ).join('\n');

      embed.addFields({
        name: '🏆 Discord Badges',
        value: flagList,
        inline: true
      });
    }

    // Security Assessment
    const securityFlags = [];
    const accountAge = Date.now() - user.createdTimestamp;
    
    if (accountAge < 7 * 24 * 60 * 60 * 1000) { // Less than 7 days
      securityFlags.push('🔴 Very new account');
    } else if (accountAge < 30 * 24 * 60 * 60 * 1000) { // Less than 30 days
      securityFlags.push('🟡 New account');
    }

    if (user.avatar === null) {
      securityFlags.push('🟡 Default avatar');
    }

    if (member && member.joinedTimestamp) {
      const joinAge = Date.now() - member.joinedTimestamp;
      if (joinAge < 24 * 60 * 60 * 1000) { // Less than 24 hours
        securityFlags.push('🔴 Very recently joined');
      }
    }

    if (securityFlags.length > 0) {
      embed.addFields({
        name: '🔒 Security Assessment',
        value: securityFlags.join('\n'),
        inline: false
      });
    }

    // Mutual Servers (if bot can see them)
    try {
      const mutualGuilds = interaction.client.guilds.cache.filter((guild: any) => 
        guild.members.cache.has(user.id)
      );

      if (mutualGuilds.size > 1) {
        embed.addFields({
          name: '🤝 Mutual Servers',
          value: `${mutualGuilds.size} mutual servers`,
          inline: true
        });
      }
    } catch (error) {
      console.log('Error checking mutual servers:', error);
    }

    // Footer
    embed.setFooter({
      text: `Requested by ${interaction.user.username} • Target: ${user.id}`,
      iconURL: interaction.user.displayAvatarURL()
    });

    // Set banner if available
    if (user.bannerURL()) {
      embed.setImage(user.bannerURL({ size: 1024 }));
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in whois command:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to fetch user information. The user might not exist.')],
    });
  }
}