import { SlashCommandBuilder, EmbedBuilder, ChannelType, GuildVerificationLevel, GuildExplicitContentFilter, GuildDefaultMessageNotifications, GuildMFALevel } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, formatNumber } from '../../utils/helpers';
import { emojis, colors } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Get comprehensive information about the server')
  .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  try {
    await interaction.deferReply();

    const guild = await interaction.guild.fetch();
    const owner = await guild.fetchOwner();

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.server} ${guild.name}`)
      .setColor(colors.primary)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .setTimestamp();

    // Basic Information
    embed.addFields({
      name: '📋 Basic Information',
      value: [
        `**Name:** ${guild.name}`,
        `**ID:** \`${guild.id}\``,
        `**Owner:** ${owner.user.username} (${owner.user.id})`,
        `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
        `**Description:** ${guild.description || 'None'}`
      ].join('\n'),
      inline: true
    });

    // Server Statistics
    const members = await guild.members.fetch();
    const bots = members.filter(member => member.user.bot).size;
    const humans = members.size - bots;

    const channels = guild.channels.cache;
    const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;
    const threads = channels.filter(c => c.isThread()).size;

    embed.addFields({
      name: '📊 Statistics',
      value: [
        `**Total Members:** ${formatNumber(guild.memberCount)}`,
        `**Humans:** ${formatNumber(humans)}`,
        `**Bots:** ${formatNumber(bots)}`,
        `**Roles:** ${formatNumber(guild.roles.cache.size)}`,
        `**Emojis:** ${formatNumber(guild.emojis.cache.size)}`,
        `**Stickers:** ${formatNumber(guild.stickers.cache.size)}`
      ].join('\n'),
      inline: true
    });

    // Channel Information
    embed.addFields({
      name: '📁 Channels',
      value: [
        `**Text Channels:** ${textChannels}`,
        `**Voice Channels:** ${voiceChannels}`,
        `**Categories:** ${categories}`,
        `**Threads:** ${threads}`,
        `**Total Channels:** ${channels.size}`,
        `**AFK Channel:** ${guild.afkChannel ? `${guild.afkChannel}` : 'None'}`
      ].join('\n'),
      inline: true
    });

    // Server Features
    const features = guild.features.map(feature => {
      const featureNames: { [key: string]: string } = {
        ANIMATED_BANNER: 'Animated Banner',
        ANIMATED_ICON: 'Animated Icon',
        APPLICATION_COMMAND_PERMISSIONS_V2: 'App Command Permissions V2',
        AUTO_MODERATION: 'Auto Moderation',
        BANNER: 'Banner',
        COMMUNITY: 'Community Server',
        CREATOR_MONETIZABLE_DISABLED: 'Creator Monetization Disabled',
        CREATOR_STORE_PAGE: 'Creator Store Page',
        DEVELOPER_SUPPORT_SERVER: 'Developer Support Server',
        DISCOVERABLE: 'Server Discovery',
        FEATURABLE: 'Featurable',
        INVITES_DISABLED: 'Invites Disabled',
        INVITE_SPLASH: 'Invite Splash',
        MEMBER_VERIFICATION_GATE_ENABLED: 'Member Verification Gate',
        MORE_STICKERS: 'More Stickers',
        NEWS: 'News Channels',
        PARTNERED: 'Partnered',
        PREVIEW_ENABLED: 'Preview Enabled',
        RAID_ALERTS_DISABLED: 'Raid Alerts Disabled',
        ROLE_ICONS: 'Role Icons',
        ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE: 'Role Subscriptions',
        ROLE_SUBSCRIPTIONS_ENABLED: 'Role Subscriptions Enabled',
        TICKETED_EVENTS_ENABLED: 'Ticketed Events',
        VANITY_URL: 'Vanity URL',
        VERIFIED: 'Verified',
        VIP_REGIONS: 'VIP Voice Regions',
        WELCOME_SCREEN_ENABLED: 'Welcome Screen'
      };
      return featureNames[feature] || feature.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    });

    if (features.length > 0) {
      embed.addFields({
        name: '✨ Server Features',
        value: features.slice(0, 10).join('\n') + (features.length > 10 ? '\n*...and more*' : ''),
        inline: false
      });
    }

    // Security Settings
    const verificationLevels: { [key: number]: string } = {
      [GuildVerificationLevel.None]: 'None',
      [GuildVerificationLevel.Low]: 'Low',
      [GuildVerificationLevel.Medium]: 'Medium',
      [GuildVerificationLevel.High]: 'High',
      [GuildVerificationLevel.VeryHigh]: 'Very High'
    };

    const contentFilters: { [key: number]: string } = {
      [GuildExplicitContentFilter.Disabled]: 'Disabled',
      [GuildExplicitContentFilter.MembersWithoutRoles]: 'Members without roles',
      [GuildExplicitContentFilter.AllMembers]: 'All members'
    };

    const notificationLevels: { [key: number]: string } = {
      [GuildDefaultMessageNotifications.AllMessages]: 'All messages',
      [GuildDefaultMessageNotifications.OnlyMentions]: 'Only mentions'
    };

    const mfaLevels: { [key: number]: string } = {
      [GuildMFALevel.None]: 'None',
      [GuildMFALevel.Elevated]: 'Enabled'
    };

    embed.addFields({
      name: '🔒 Security & Moderation',
      value: [
        `**Verification Level:** ${verificationLevels[guild.verificationLevel]}`,
        `**Content Filter:** ${contentFilters[guild.explicitContentFilter]}`,
        `**Default Notifications:** ${notificationLevels[guild.defaultMessageNotifications]}`,
        `**2FA Requirement:** ${mfaLevels[guild.mfaLevel]}`,
        `**System Channel:** ${guild.systemChannel || 'None'}`,
        `**Rules Channel:** ${guild.rulesChannel || 'None'}`
      ].join('\n'),
      inline: true
    });

    // Boosts and Premium
    embed.addFields({
      name: '💎 Premium Status',
      value: [
        `**Boost Tier:** ${guild.premiumTier}`,
        `**Boost Count:** ${guild.premiumSubscriptionCount || 0}`,
        `**Boosters:** ${formatNumber(guild.members.cache.filter(m => m.premiumSince).size)}`,
        `**Max Members:** ${formatNumber(guild.maximumMembers || 500000)}`,
        `**Max Presence:** ${formatNumber(guild.maximumPresences || 25000)}`,
        `**File Size Limit:** ${guild.premiumTier >= 2 ? '50MB' : guild.premiumTier >= 1 ? '8MB' : '8MB'}`
      ].join('\n'),
      inline: true
    });

    // Additional Info
    const additionalInfo = [];
    if (guild.vanityURLCode) additionalInfo.push(`**Vanity URL:** discord.gg/${guild.vanityURLCode}`);
    if (guild.preferredLocale) additionalInfo.push(`**Preferred Locale:** ${guild.preferredLocale}`);
    if (guild.afkTimeout) additionalInfo.push(`**AFK Timeout:** ${guild.afkTimeout / 60} minutes`);
    if (guild.widgetEnabled !== null) additionalInfo.push(`**Widget Enabled:** ${guild.widgetEnabled ? 'Yes' : 'No'}`);

    if (additionalInfo.length > 0) {
      embed.addFields({
        name: '🔧 Additional Settings',
        value: additionalInfo.join('\n'),
        inline: false
      });
    }

    // Server Icon and Banner
    const mediaLinks = [];
    if (guild.iconURL()) mediaLinks.push(`[Icon](${guild.iconURL({ size: 1024 })})`);
    if (guild.bannerURL()) mediaLinks.push(`[Banner](${guild.bannerURL({ size: 1024 })})`);
    if (guild.splashURL()) mediaLinks.push(`[Splash](${guild.splashURL({ size: 1024 })})`);

    if (mediaLinks.length > 0) {
      embed.addFields({
        name: '🖼️ Media',
        value: mediaLinks.join(' • '),
        inline: false
      });
    }

    // Set banner image if available
    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }));
    }

    // Footer
    embed.setFooter({
      text: `Requested by ${interaction.user.username} • Server ID: ${guild.id}`,
      iconURL: interaction.user.displayAvatarURL()
    });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error fetching server info:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to fetch server information. Please try again.')],
    });
  }
}