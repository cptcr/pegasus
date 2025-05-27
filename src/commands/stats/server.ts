// src/commands/stats/server.ts - Fixed Type Issues
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: 'server',
  description: 'Display comprehensive server statistics and information',
  category: 'stats',
  usage: '/server',
  examples: ['/server'],
  aliases: ['serverinfo', 'guild', 'guildinfo'],
  cooldown: 10,
  guildOnly: true
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Display comprehensive server statistics and information'),
  category: 'stats',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Fetch comprehensive guild data
      const guild = await interaction.guild.fetch();
      const owner = await guild.fetchOwner().catch(() => null);
      
      // Fetch members for more accurate statistics
      await guild.members.fetch();

      // Calculate member statistics
      const totalMembers = guild.memberCount;
      const humans = guild.members.cache.filter(member => !member.user.bot).size;
      const bots = guild.members.cache.filter(member => member.user.bot).size;
      const onlineMembers = guild.presences.cache.filter(presence => 
        presence.status !== 'offline'
      ).size;
      
      // Calculate channel statistics
      const textChannels = guild.channels.cache.filter(channel => 
        channel.type === ChannelType.GuildText
      ).size;
      const voiceChannels = guild.channels.cache.filter(channel => 
        channel.type === ChannelType.GuildVoice
      ).size;
      const categories = guild.channels.cache.filter(channel => 
        channel.type === ChannelType.GuildCategory
      ).size;
      const forumChannels = guild.channels.cache.filter(channel => 
        channel.type === ChannelType.GuildForum
      ).size;
      const stageChannels = guild.channels.cache.filter(channel => 
        channel.type === ChannelType.GuildStageVoice
      ).size;

      // Database statistics
      const dbStats = await getServerDatabaseStats(client, guild.id);

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${guild.name}`)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .setColor(Config.COLORS.PRIMARY)
        .setFooter({ 
          text: `Server ID: ${guild.id}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Server banner if available
      if (guild.bannerURL()) {
        embed.setImage(guild.bannerURL({ size: 1024 }));
      }

      // Basic Information
      const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);
      embed.addFields({
        name: '🏠 Basic Information',
        value: [
          `**Owner:** ${owner ? `${owner.user.tag} (${owner.user.id})` : 'Unknown'}`,
          `**Created:** <t:${createdTimestamp}:F>`,
          `**Created:** <t:${createdTimestamp}:R>`,
          `**Verification Level:** ${getVerificationLevel(guild.verificationLevel)}`,
          `**Boost Level:** ${guild.premiumTier} (${guild.premiumSubscriptionCount || 0} boosts)`
        ].join('\n'),
        inline: true
      });

      // Member Statistics
      embed.addFields({
        name: '👥 Members',
        value: [
          `**Total:** ${totalMembers.toLocaleString()}`,
          `**Humans:** ${humans.toLocaleString()}`,
          `**Bots:** ${bots.toLocaleString()}`,
          `**Online:** ${onlineMembers.toLocaleString()}`,
          `**Max Members:** ${guild.maximumMembers?.toLocaleString() || 'Unknown'}`
        ].join('\n'),
        inline: true
      });

      // Channel Statistics
      embed.addFields({
        name: '📺 Channels',
        value: [
          `**Total:** ${guild.channels.cache.size}`,
          `**Text:** ${textChannels}`,
          `**Voice:** ${voiceChannels}`,
          `**Categories:** ${categories}`,
          forumChannels > 0 ? `**Forums:** ${forumChannels}` : '',
          stageChannels > 0 ? `**Stages:** ${stageChannels}` : ''
        ].filter(Boolean).join('\n'),
        inline: true
      });

      // Role and Emoji Statistics
      const roles = guild.roles.cache.size - 1; // Exclude @everyone
      const emojis = guild.emojis.cache.size;
      const stickers = guild.stickers.cache.size;

      embed.addFields({
        name: '🎭 Customization',
        value: [
          `**Roles:** ${roles}`,
          `**Max Bitrate:** ${guild.maximumBitrate / 1000}kbps`
        ].join('\n'),
        inline: true
      });

      // Features
      const features = guild.features.length > 0 ? 
        guild.features.map(feature => 
          feature.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
        ).join(', ') : 'None';

      embed.addFields({
        name: '✨ Features',
        value: features.length > 1024 ? features.substring(0, 1021) + '...' : features,
        inline: false
      });

      // Database Statistics
      if (dbStats) {
        embed.addFields({
          name: '📊 Bot Statistics',
          value: [
            `**Active Polls:** ${dbStats.activePolls}`,
            `**Active Giveaways:** ${dbStats.activeGiveaways}`,
            `**Open Tickets:** ${dbStats.openTickets}`,
            `**Total Warnings:** ${dbStats.totalWarnings}`,
            `**Active Quarantine:** ${dbStats.activeQuarantine}`,
            `**Level Rewards:** ${dbStats.levelRewards}`,
            `**Custom Commands:** ${dbStats.customCommands}`
          ].join('\n'),
          inline: true
        });

        // Activity Statistics
        const activityRate = dbStats.totalMembers > 0 ? 
          ((dbStats.activeMembers / dbStats.totalMembers) * 100).toFixed(1) : '0.0';
        
        embed.addFields({
          name: '📈 Activity',
          value: [
            `**Tracked Members:** ${dbStats.totalMembers}`,
            `**Active Members:** ${dbStats.activeMembers}`,
            `**Activity Rate:** ${activityRate}%`,
            `**Total Messages:** ${dbStats.totalMessages.toLocaleString()}`,
            `**Total Voice Time:** ${Math.floor(dbStats.totalVoiceTime / 3600)}h`
          ].join('\n'),
          inline: true
        });
      }

      // Create buttons for additional information
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('server-roles')
            .setLabel('View Roles')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎭'),
          new ButtonBuilder()
            .setCustomId('server-channels')
            .setLabel('Channel List')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📺'),
          new ButtonBuilder()
            .setCustomId('server-emojis')
            .setLabel('Emojis')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('😄')
        );

      // Add invite button if bot has permission
      if (guild.members.me?.permissions.has('CreateInstantInvite')) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('server-invite')
            .setLabel('Create Invite')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔗')
        );
      }

      await interaction.editReply({ 
        embeds: [embed], 
        components: [row]
      });

      // Emit to dashboard
      client.wsManager.emitRealtimeEvent(guild.id, 'stats:server_viewed', {
        viewerId: interaction.user.id,
        guildId: guild.id,
        guildName: guild.name
      });

      client.logger.debug(`${interaction.user.tag} viewed server stats for ${guild.name}`);

    } catch (error) {
      client.logger.error('Error executing server stats command:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while fetching server statistics.',
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: '❌ An error occurred while fetching server statistics.'
        });
      }
    }
  }
};

async function getServerDatabaseStats(client: ExtendedClient, guildId: string) {
  try {
    const [
      activePolls,
      activeGiveaways,
      openTickets,
      totalWarnings,
      activeQuarantine,
      levelRewards,
      customCommands,
      userLevels
    ] = await Promise.all([
      client.db.poll.count({
        where: { guildId, active: true }
      }),
      client.db.giveaway.count({
        where: { guildId, active: true, ended: false }
      }),
      client.db.ticket.count({
        where: { 
          guildId, 
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] }
        }
      }),
      client.db.warn.count({
        where: { guildId, active: true }
      }),
      client.db.quarantine.count({
        where: { guildId, active: true }
      }),
      client.db.levelReward.count({
        where: { guildId }
      }),
      client.db.customCommand.count({
        where: { guildId, enabled: true }
      }),
      client.db.userLevel.findMany({
        where: { guildId },
        select: { messages: true, voiceTime: true, level: true }
      })
    ]);

    const totalMembers = userLevels.length;
    // FIXED: Added proper type annotations for ul parameter
    const activeMembers = userLevels.filter((ul: any) => ul.messages > 10 || ul.voiceTime > 3600).length;
    // FIXED: Added proper type annotations for sum and ul parameters  
    const totalMessages = userLevels.reduce((sum: number, ul: any) => sum + ul.messages, 0);
    const totalVoiceTime = userLevels.reduce((sum: number, ul: any) => sum + ul.voiceTime, 0);

    return {
      activePolls,
      activeGiveaways,
      openTickets,
      totalWarnings,
      activeQuarantine,
      levelRewards,
      customCommands,
      totalMembers,
      activeMembers,
      totalMessages,
      totalVoiceTime
    };
  } catch (error) {
    client.logger.error('Error fetching database stats:', error);
    return null;
  }
}

function getVerificationLevel(level: number): string {
  const levels = [
    'None',
    'Low - Must have verified email',
    'Medium - Must be registered for 5+ minutes',
    'High - Must be server member for 10+ minutes',
    'Highest - Must have verified phone'
  ];
  return levels[level] || 'Unknown';
}

export default command;