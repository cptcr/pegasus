import { SlashCommandBuilder, EmbedBuilder, Role } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, formatNumber, formatTimeAgo } from '../../utils/helpers';
import { emojis, colors } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('roleinfo')
  .setDescription('Get detailed information about a role')
  .addRoleOption(option =>
    option.setName('role')
      .setDescription('Role to get information about')
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

  const role = interaction.options.getRole('role', true) as Role;

  try {
    const embed = new EmbedBuilder()
      .setTitle(`${emojis.role} Role Information`)
      .setColor(role.hexColor || colors.primary)
      .setTimestamp();

    // Basic Information
    embed.addFields({
      name: '📋 Basic Information',
      value: [
        `**Name:** ${role.name}`,
        `**ID:** \`${role.id}\``,
        `**Mention:** ${role}`,
        `**Color:** ${role.hexColor || 'Default'}`,
        `**Position:** ${role.position}`,
        `**Members:** ${formatNumber(role.members.size)}`
      ].join('\n'),
      inline: true
    });

    // Role Settings
    embed.addFields({
      name: '⚙️ Settings',
      value: [
        `**Hoisted:** ${role.hoist ? 'Yes' : 'No'}`,
        `**Mentionable:** ${role.mentionable ? 'Yes' : 'No'}`,
        `**Managed:** ${role.managed ? 'Yes' : 'No'}`,
        `**Created:** <t:${Math.floor(role.createdTimestamp / 1000)}:F>`,
        `**Created:** ${formatTimeAgo(role.createdAt)}`
      ].join('\n'),
      inline: true
    });

    // Integration Info (if managed)
    if (role.managed) {
      let managedBy = 'Unknown Integration';
      
      // Check for bot roles
      const botMember = role.guild.members.cache.find(member => 
        member.user.bot && member.roles.highest.id === role.id
      );
      
      if (botMember) {
        managedBy = `Bot: ${botMember.user.username}`;
      }
      
      // Check for boost role
      if (role.tags?.premiumSubscriberRole) {
        managedBy = 'Server Booster Role';
      }
      
      // Check for integration role
      if (role.tags?.integrationId) {
        managedBy = `Integration: ${role.tags.integrationId}`;
      }

      embed.addFields({
        name: '🤖 Integration Info',
        value: [
          `**Managed By:** ${managedBy}`,
          `**Bot Role:** ${role.tags?.botId ? 'Yes' : 'No'}`,
          `**Boost Role:** ${role.tags?.premiumSubscriberRole ? 'Yes' : 'No'}`
        ].join('\n'),
        inline: true
      });
    }

    // Permissions
    const permissions = role.permissions.toArray();
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
      'ManageWebhooks',
      'ManageNicknames',
      'ManageEmojisAndStickers',
      'UseSlashCommands',
      'SendMessages',
      'EmbedLinks',
      'AttachFiles',
      'ReadMessageHistory',
      'UseExternalEmojis',
      'Connect',
      'Speak',
      'MuteMembers',
      'DeafenMembers',
      'MoveMembers',
      'UseVAD',
      'Stream'
    ];

    const hasKeyPermissions = keyPermissions.filter(perm => permissions.includes(perm as any));
    const dangerousPermissions = [
      'Administrator',
      'ManageGuild',
      'ManageRoles',
      'BanMembers',
      'KickMembers',
      'ManageChannels',
      'ManageWebhooks',
      'MentionEveryone'
    ];

    const hasDangerousPermissions = dangerousPermissions.filter(perm => permissions.includes(perm as any));

    if (hasKeyPermissions.length > 0) {
      embed.addFields({
        name: `🔐 Key Permissions (${hasKeyPermissions.length}/${keyPermissions.length})`,
        value: hasKeyPermissions.map(perm => `• ${perm.replace(/([A-Z])/g, ' $1').trim()}`).join('\n').substring(0, 1024),
        inline: false
      });
    }

    if (hasDangerousPermissions.length > 0) {
      embed.addFields({
        name: `⚠️ Dangerous Permissions (${hasDangerousPermissions.length})`,
        value: hasDangerousPermissions.map(perm => `• ${perm.replace(/([A-Z])/g, ' $1').trim()}`).join('\n'),
        inline: false
      });
    }

    // Role Hierarchy
    const higherRoles = role.guild.roles.cache
      .filter(r => r.position > role.position && r.id !== role.guild.roles.everyone.id)
      .sort((a, b) => b.position - a.position)
      .first(5);

    const lowerRoles = role.guild.roles.cache
      .filter(r => r.position < role.position && r.id !== role.guild.roles.everyone.id)
      .sort((a, b) => b.position - a.position)
      .first(5);

    if (higherRoles.length > 0 || lowerRoles.length > 0) {
      const hierarchyText = [];
      
      if (higherRoles.length > 0) {
        hierarchyText.push(`**Higher Roles:** ${higherRoles.map(r => r.name).join(', ')}`);
      }
      
      if (lowerRoles.length > 0) {
        hierarchyText.push(`**Lower Roles:** ${lowerRoles.map(r => r.name).join(', ')}`);
      }

      embed.addFields({
        name: '📊 Role Hierarchy',
        value: hierarchyText.join('\n'),
        inline: false
      });
    }

    // Members with this role (show first 10)
    if (role.members.size > 0) {
      const memberList = role.members
        .sort((a, b) => (b.joinedTimestamp || 0) - (a.joinedTimestamp || 0))
        .first(10)
        .map(member => `• ${member.user.username}`)
        .join('\n');

      embed.addFields({
        name: `👥 Members (${role.members.size})`,
        value: memberList + (role.members.size > 10 ? '\n*...and more*' : ''),
        inline: false
      });
    }

    // Statistics
    const stats = [];
    stats.push(`**Total Permissions:** ${permissions.length}`);
    stats.push(`**Dangerous Permissions:** ${hasDangerousPermissions.length}`);
    stats.push(`**Position Rank:** ${role.guild.roles.cache.size - role.position}/${role.guild.roles.cache.size}`);
    
    // Calculate percentage of members with this role
    const percentage = ((role.members.size / role.guild.memberCount) * 100).toFixed(1);
    stats.push(`**Member Percentage:** ${percentage}%`);

    embed.addFields({
      name: '📈 Statistics',
      value: stats.join('\n'),
      inline: true
    });

    // Color preview
    if (role.hexColor !== '#000000') {
      embed.addFields({
        name: '🎨 Color Preview',
        value: `**Hex:** ${role.hexColor}\n**RGB:** ${role.color.toString()}\n**Preview:** [Click here](https://www.color-hex.com/color/${role.hexColor.slice(1)})`,
        inline: true
      });
    }

    // Footer
    embed.setFooter({
      text: `Requested by ${interaction.user.username} • Role ID: ${role.id}`,
      iconURL: interaction.user.displayAvatarURL()
    });

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error fetching role info:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to fetch role information. Please try again.')],
      ephemeral: true,
    });
  }
}