import { SlashCommandBuilder, EmbedBuilder, GuildMember, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/helpers';
import { emojis, colors } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('permissions')
  .setDescription('Check user permissions in the server or a specific channel')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to check permissions for')
      .setRequired(false)
  )
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Channel to check permissions for (default: current channel)')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('detailed')
      .setDescription('Show detailed permission breakdown')
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
  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
  const detailed = interaction.options.getBoolean('detailed') || false;

  try {
    const member = await interaction.guild.members.fetch(targetUser.id);
    
    const embed = new EmbedBuilder()
      .setTitle(`${emojis.permissions} Permission Check`)
      .setColor(member.displayHexColor || colors.primary)
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    // Basic Information
    embed.addFields({
      name: '👤 Target Information',
      value: [
        `**User:** ${targetUser}`,
        `**Highest Role:** ${member.roles.highest}`,
        `**Role Position:** ${member.roles.highest.position}`,
        `**Administrator:** ${member.permissions.has(PermissionFlagsBits.Administrator) ? '✅ Yes' : '❌ No'}`
      ].join('\n'),
      inline: true
    });

    // Server Permissions
    const serverPerms = member.permissions;
    const importantServerPerms = [
      { name: 'Administrator', flag: PermissionFlagsBits.Administrator },
      { name: 'Manage Server', flag: PermissionFlagsBits.ManageGuild },
      { name: 'Manage Roles', flag: PermissionFlagsBits.ManageRoles },
      { name: 'Manage Channels', flag: PermissionFlagsBits.ManageChannels },
      { name: 'Kick Members', flag: PermissionFlagsBits.KickMembers },
      { name: 'Ban Members', flag: PermissionFlagsBits.BanMembers },
      { name: 'Manage Messages', flag: PermissionFlagsBits.ManageMessages },
      { name: 'Mention Everyone', flag: PermissionFlagsBits.MentionEveryone },
      { name: 'View Audit Log', flag: PermissionFlagsBits.ViewAuditLog },
      { name: 'Manage Webhooks', flag: PermissionFlagsBits.ManageWebhooks },
      { name: 'Manage Nicknames', flag: PermissionFlagsBits.ManageNicknames },
      { name: 'Manage Emojis', flag: PermissionFlagsBits.ManageEmojisAndStickers },
      { name: 'Timeout Members', flag: PermissionFlagsBits.ModerateMembers }
    ];

    const hasServerPerms = importantServerPerms.filter(perm => serverPerms.has(perm.flag));
    const serverPermText = hasServerPerms.length > 0 
      ? hasServerPerms.map(perm => `✅ ${perm.name}`).join('\n')
      : '❌ No important server permissions';

    embed.addFields({
      name: `🏰 Server Permissions (${hasServerPerms.length}/${importantServerPerms.length})`,
      value: serverPermText.length > 1024 ? serverPermText.substring(0, 1020) + '...' : serverPermText,
      inline: true
    });

    // Channel Permissions (if applicable)
    if (targetChannel && !targetChannel.isDMBased()) {
      const channelPerms = member.permissionsIn(targetChannel);
      const importantChannelPerms = [
        { name: 'View Channel', flag: PermissionFlagsBits.ViewChannel },
        { name: 'Send Messages', flag: PermissionFlagsBits.SendMessages },
        { name: 'Read Message History', flag: PermissionFlagsBits.ReadMessageHistory },
        { name: 'Embed Links', flag: PermissionFlagsBits.EmbedLinks },
        { name: 'Attach Files', flag: PermissionFlagsBits.AttachFiles },
        { name: 'Use External Emojis', flag: PermissionFlagsBits.UseExternalEmojis },
        { name: 'Add Reactions', flag: PermissionFlagsBits.AddReactions },
        { name: 'Manage Messages', flag: PermissionFlagsBits.ManageMessages },
        { name: 'Create Threads', flag: PermissionFlagsBits.CreatePublicThreads },
        { name: 'Send Messages in Threads', flag: PermissionFlagsBits.SendMessagesInThreads }
      ];

      // Add voice permissions if it's a voice channel
      if (targetChannel.type === ChannelType.GuildVoice || targetChannel.type === ChannelType.GuildStageVoice) {
        importantChannelPerms.push(
          { name: 'Connect', flag: PermissionFlagsBits.Connect },
          { name: 'Speak', flag: PermissionFlagsBits.Speak },
          { name: 'Stream', flag: PermissionFlagsBits.Stream },
          { name: 'Use Voice Activity', flag: PermissionFlagsBits.UseVAD },
          { name: 'Mute Members', flag: PermissionFlagsBits.MuteMembers },
          { name: 'Deafen Members', flag: PermissionFlagsBits.DeafenMembers },
          { name: 'Move Members', flag: PermissionFlagsBits.MoveMembers }
        );
      }

      const hasChannelPerms = importantChannelPerms.filter(perm => channelPerms.has(perm.flag));
      const deniedChannelPerms = importantChannelPerms.filter(perm => !channelPerms.has(perm.flag));

      const channelPermText = hasChannelPerms.map(perm => `✅ ${perm.name}`).join('\n');
      const deniedPermText = deniedChannelPerms.map(perm => `❌ ${perm.name}`).join('\n');

      embed.addFields({
        name: `#️⃣ Channel Permissions - ${targetChannel.name}`,
        value: `**Allowed (${hasChannelPerms.length}):**\n${channelPermText || 'None'}\n\n**Denied (${deniedChannelPerms.length}):**\n${deniedPermText || 'None'}`.substring(0, 1024),
        inline: false
      });
    }

    // Role Hierarchy
    const userRoles = member.roles.cache
      .filter(role => role.id !== interaction.guild.roles.everyone.id)
      .sort((a, b) => b.position - a.position)
      .first(10);

    if (userRoles.length > 0) {
      const roleList = userRoles.map(role => `${role} (${role.position})`).join('\n');
      embed.addFields({
        name: `🎭 Roles (${member.roles.cache.size - 1})`,
        value: roleList + (member.roles.cache.size > 11 ? '\n*...and more*' : ''),
        inline: false
      });
    }

    // Detailed Permission Breakdown
    if (detailed) {
      const allPerms = Object.entries(PermissionFlagsBits)
        .filter(([key, value]) => typeof value === 'bigint')
        .map(([key, flag]) => ({
          name: key.replace(/([A-Z])/g, ' $1').trim(),
          has: serverPerms.has(flag as bigint)
        }))
        .sort((a, b) => {
          if (a.has && !b.has) return -1;
          if (!a.has && b.has) return 1;
          return a.name.localeCompare(b.name);
        });

      const allowedPerms = allPerms.filter(p => p.has).map(p => p.name);
      const deniedPerms = allPerms.filter(p => !p.has).map(p => p.name);

      if (allowedPerms.length > 0) {
        embed.addFields({
          name: `✅ All Allowed Permissions (${allowedPerms.length})`,
          value: allowedPerms.join(', ').substring(0, 1024),
          inline: false
        });
      }

      if (deniedPerms.length > 0 && deniedPerms.length < 30) { // Don't show if too many
        embed.addFields({
          name: `❌ Denied Permissions (${deniedPerms.length})`,
          value: deniedPerms.join(', ').substring(0, 1024),
          inline: false
        });
      }
    }

    // Permission Level Assessment
    let permissionLevel = 'User';
    let permissionColor = colors.primary;

    if (member.id === interaction.guild.ownerId) {
      permissionLevel = 'Server Owner';
      permissionColor = colors.warning;
    } else if (serverPerms.has(PermissionFlagsBits.Administrator)) {
      permissionLevel = 'Administrator';
      permissionColor = colors.error;
    } else if (serverPerms.has(PermissionFlagsBits.ManageGuild) || 
               serverPerms.has(PermissionFlagsBits.ManageRoles) ||
               serverPerms.has(PermissionFlagsBits.BanMembers)) {
      permissionLevel = 'Senior Moderator';
      permissionColor = colors.warning;
    } else if (serverPerms.has(PermissionFlagsBits.ManageMessages) ||
               serverPerms.has(PermissionFlagsBits.KickMembers) ||
               serverPerms.has(PermissionFlagsBits.ModerateMembers)) {
      permissionLevel = 'Moderator';
      permissionColor = colors.info;
    } else if (serverPerms.has(PermissionFlagsBits.ManageChannels) ||
               serverPerms.has(PermissionFlagsBits.ManageNicknames)) {
      permissionLevel = 'Helper';
      permissionColor = colors.success;
    }

    embed.setColor(permissionColor);
    embed.addFields({
      name: '📊 Permission Level',
      value: `**${permissionLevel}**`,
      inline: true
    });

    // Security Notes
    const securityNotes = [];
    if (serverPerms.has(PermissionFlagsBits.Administrator)) {
      securityNotes.push('⚠️ Has Administrator permission (bypasses all permission checks)');
    }
    if (serverPerms.has(PermissionFlagsBits.ManageRoles) && 
        member.roles.highest.position >= interaction.guild.members.me!.roles.highest.position) {
      securityNotes.push('🔴 Can manage roles equal to or higher than the bot');
    }
    if (serverPerms.has(PermissionFlagsBits.BanMembers) && serverPerms.has(PermissionFlagsBits.KickMembers)) {
      securityNotes.push('🟡 Can ban and kick members');
    }

    if (securityNotes.length > 0) {
      embed.addFields({
        name: '🔒 Security Notes',
        value: securityNotes.join('\n'),
        inline: false
      });
    }

    embed.setFooter({
      text: `Requested by ${interaction.user.username}${detailed ? ' • Detailed view' : ''}`,
      iconURL: interaction.user.displayAvatarURL()
    });

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error checking permissions:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to check permissions. The user might not be in this server.')],
      ephemeral: true,
    });
  }
}