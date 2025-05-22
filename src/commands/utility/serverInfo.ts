// src/commands/utility/serverinfo.ts
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { DatabaseService } from '../../lib/database';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Display detailed server information');

export async function run({ interaction }: { interaction: any }) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply();

  try {
    // Get guild settings and stats from database
    const [guildSettings, guildStats] = await Promise.all([
      DatabaseService.getGuildSettings(guild.id),
      DatabaseService.getGuildStats(guild.id)
    ]);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`📊 ${guild.name} - Server Information`)
      .setThumbnail(guild.iconURL() || null)
      .addFields(
        {
          name: '🆔 Server ID',
          value: guild.id,
          inline: true
        },
        {
          name: '👑 Owner',
          value: `<@${guild.ownerId}>`,
          inline: true
        },
        {
          name: '📅 Created',
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
          inline: true
        },
        {
          name: '👥 Members',
          value: guild.memberCount.toString(),
          inline: true
        },
        {
          name: '📺 Channels',
          value: guild.channels.cache.size.toString(),
          inline: true
        },
        {
          name: '🎭 Roles',
          value: guild.roles.cache.size.toString(),
          inline: true
        },
        {
          name: '😀 Emojis',
          value: guild.emojis.cache.size.toString(),
          inline: true
        },
        {
          name: '🔔 Notification Level',
          value: guild.defaultMessageNotifications === 0 ? 'All Messages' : 'Only Mentions',
          inline: true
        },
        {
          name: '🛡️ Verification Level',
          value: ['None', 'Low', 'Medium', 'High', 'Very High'][guild.verificationLevel] || 'Unknown',
          inline: true
        }
      );

    // Add bot features section
    const enabledFeatures = [];
    if (guildSettings.enableLeveling) enabledFeatures.push('📊 Leveling');
    if (guildSettings.enableModeration) enabledFeatures.push('🛡️ Moderation');
    if (guildSettings.enableGeizhals) enabledFeatures.push('💰 Price Tracking');
    if (guildSettings.enablePolls) enabledFeatures.push('📋 Polls');
    if (guildSettings.enableGiveaways) enabledFeatures.push('🎁 Giveaways');
    if (guildSettings.enableTickets) enabledFeatures.push('🎫 Tickets');
    if (guildSettings.enableMusic) enabledFeatures.push('🎵 Music');
    if (guildSettings.enableAutomod) enabledFeatures.push('🤖 Automod');

    if (enabledFeatures.length > 0) {
      embed.addFields({
        name: '🤖 Enabled Bot Features',
        value: enabledFeatures.join('\n'),
        inline: false
      });
    }

    // Add activity statistics
    embed.addFields({
      name: '📈 Activity Statistics',
      value: [
        `👤 Tracked Users: ${guildStats.totalUsers}`,
        `⚠️ Active Warnings: ${guildStats.totalWarns}`,
        `🔒 In Quarantine: ${guildStats.activeQuarantine}`,
        `📊 Active Polls: ${guildStats.activePolls}`,
        `🎁 Active Giveaways: ${guildStats.activeGiveaways}`,
        `🎫 Open Tickets: ${guildStats.openTickets}`,
        `⚙️ Custom Commands: ${guildStats.customCommands}`
      ].join('\n'),
      inline: false
    });

    // Add server features if any
    if (guild.features.length > 0) {
      const premiumFeatures = guild.features.map((feature: string) => 
        feature.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
      ).join(', ');
      
      embed.addFields({
        name: '✨ Premium Features',
        value: premiumFeatures,
        inline: false
      });
    }

    embed.setFooter({
      text: `Prefix: ${guildSettings.prefix} • Use /help for commands`,
      iconURL: interaction.client.user.displayAvatarURL()
    }).setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in serverinfo command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching server information.'
    });
  }
}