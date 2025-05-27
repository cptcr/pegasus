// src/commands/stats/leaderboard.ts - Leaderboard Statistics Command
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: 'leaderboard',
  description: 'View server leaderboards for various statistics',
  category: 'stats',
  usage: '/leaderboard [type] [page]',
  examples: [
    '/leaderboard',
    '/leaderboard type:messages',
    '/leaderboard type:voice page:2'
  ],
  aliases: ['lb', 'top', 'rank'],
  cooldown: 10,
  guildOnly: true
};

const leaderboardTypes = [
  { name: 'XP & Levels', value: 'xp', description: 'Total XP and levels' },
  { name: 'Messages', value: 'messages', description: 'Total messages sent' },
  { name: 'Voice Time', value: 'voice', description: 'Time spent in voice channels' },
  { name: 'Activity', value: 'activity', description: 'Overall activity score' }
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View server leaderboards for various statistics')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of leaderboard to view')
        .setRequired(false)
        .addChoices(...leaderboardTypes))
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('Page number (10 users per page)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)),
  category: 'stats',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
    }

    const type = interaction.options.getString('type') || 'xp';
    const page = interaction.options.getInteger('page') || 1;
    const pageSize = 10;

    await interaction.deferReply();

    try {
      const leaderboardData = await getLeaderboardData(client, interaction.guild.id, type, page, pageSize);
      
      if (!leaderboardData || leaderboardData.entries.length === 0) {
        return interaction.editReply({
          content: '❌ No leaderboard data found. Users need to be active to appear on leaderboards.'
        });
      }

      const embed = await createLeaderboardEmbed(
        leaderboardData, 
        type, 
        page, 
        pageSize, 
        interaction.guild.name,
        interaction.user
      );

      const components = createNavigationComponents(
        type, 
        page, 
        leaderboardData.totalPages,
        leaderboardData.totalUsers
      );

      const response = await interaction.editReply({ 
        embeds: [embed], 
        components: components.length > 0 ? components : undefined
      });

      // Handle navigation
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000 // 5 minutes
      });

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          return buttonInteraction.reply({
            content: '❌ This leaderboard is not for you.',
            ephemeral: true
          });
        }

        const [action, newType, newPageStr] = buttonInteraction.customId.split(':');
        const newPage = parseInt(newPageStr);

        if (action === 'leaderboard') {
          await buttonInteraction.deferUpdate();

          const newData = await getLeaderboardData(client, interaction.guild!.id, newType, newPage, pageSize);
          
          if (newData) {
            const newEmbed = await createLeaderboardEmbed(
              newData, 
              newType, 
              newPage, 
              pageSize, 
              interaction.guild!.name,
              interaction.user
            );

            const newComponents = createNavigationComponents(
              newType, 
              newPage, 
              newData.totalPages,
              newData.totalUsers
            );

            await buttonInteraction.editReply({ 
              embeds: [newEmbed], 
              components: newComponents.length > 0 ? newComponents : undefined
            });
          }
        }
      });

      collector.on('end', () => {
        // Disable all buttons when collector ends
        const disabledComponents = components.map(row => {
          const newRow = ActionRowBuilder.from(row);
          newRow.components.forEach(component => {
            if ('setDisabled' in component) {
              component.setDisabled(true);
            }
          });
          return newRow;
        });

        interaction.editReply({ components: disabledComponents }).catch(() => {});
      });

      // Emit to dashboard
      client.wsManager.emitRealtimeEvent(interaction.guild.id, 'stats:leaderboard_viewed', {
        userId: interaction.user.id,
        type: type,
        page: page
      });

      client.logger.debug(`${interaction.user.tag} viewed ${type} leaderboard page ${page} in ${interaction.guild.name}`);

    } catch (error) {
      client.logger.error('Error generating leaderboard:', error);
      
      await interaction.editReply({
        content: '❌ An error occurred while generating the leaderboard. Please try again later.'
      });
    }
  }
};

interface LeaderboardEntry {
  userId: string;
  username: string;
  discriminator?: string;
  avatar?: string;
  value: number;
  rank: number;
  level?: number;
  xp?: number;
  messages?: number;
  voiceTime?: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  totalUsers: number;
  totalPages: number;
  currentPage: number;
  type: string;
}

async function getLeaderboardData(
  client: ExtendedClient, 
  guildId: string, 
  type: string, 
  page: number, 
  pageSize: number
): Promise<LeaderboardData | null> {
  try {
    const offset = (page - 1) * pageSize;
    
    let orderBy: any;
    let selectFields: any = {
      userId: true,
      xp: true,
      level: true,
      messages: true,
      voiceTime: true,
      user: {
        select: {
          username: true,
          discriminator: true,
          avatar: true
        }
      }
    };

    switch (type) {
      case 'xp':
        orderBy = { xp: 'desc' };
        break;
      case 'messages':
        orderBy = { messages: 'desc' };
        break;
      case 'voice':
        orderBy = { voiceTime: 'desc' };
        break;
      case 'activity':
        // Activity score calculation (combination of messages and voice time)
        orderBy = [{ messages: 'desc' }, { voiceTime: 'desc' }];
        break;
      default:
        orderBy = { xp: 'desc' };
    }

    const [userLevels, totalCount] = await Promise.all([
      client.db.userLevel.findMany({
        where: { guildId },
        select: selectFields,
        orderBy,
        skip: offset,
        take: pageSize
      }),
      client.db.userLevel.count({
        where: { guildId }
      })
    ]);

    const entries: LeaderboardEntry[] = userLevels.map((userLevel, index) => {
      let value: number;
      
      switch (type) {
        case 'xp':
          value = userLevel.xp;
          break;
        case 'messages':
          value = userLevel.messages;
          break;
        case 'voice':
          value = userLevel.voiceTime;
          break;
        case 'activity':
          // Simple activity score: messages + (voice hours * 10)
          value = userLevel.messages + Math.floor(userLevel.voiceTime / 360);
          break;
        default:
          value = userLevel.xp;
      }

      return {
        userId: userLevel.userId,
        username: userLevel.user.username,
        discriminator: userLevel.user.discriminator || undefined,
        avatar: userLevel.user.avatar || undefined,
        value,
        rank: offset + index + 1,
        level: userLevel.level,
        xp: userLevel.xp,
        messages: userLevel.messages,
        voiceTime: userLevel.voiceTime
      };
    });

    return {
      entries,
      totalUsers: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
      type
    };

  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    return null;
  }
}

async function createLeaderboardEmbed(
  data: LeaderboardData,
  type: string,
  page: number,
  pageSize: number,
  guildName: string,
  user: any
): Promise<EmbedBuilder> {
  const typeInfo = leaderboardTypes.find(t => t.value === type) || leaderboardTypes[0];
  
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${typeInfo.name} Leaderboard`)
    .setDescription(`**${guildName}** • Page ${page}/${data.totalPages}`)
    .setColor(Config.COLORS.PRIMARY)
    .setFooter({ 
      text: `Total ${data.totalUsers} users • Requested by ${user.username}`,
      iconURL: user.displayAvatarURL()
    })
    .setTimestamp();

  // Create leaderboard text
  let leaderboardText = '';
  
  for (const entry of data.entries) {
    const rankEmoji = getRankEmoji(entry.rank);
    const username = `${entry.username}${entry.discriminator ? `#${entry.discriminator}` : ''}`;
    const displayValue = formatValue(entry.value, type);
    
    let additionalInfo = '';
    if (type === 'xp' && entry.level !== undefined) {
      additionalInfo = ` (Level ${entry.level})`;
    } else if (type === 'activity') {
      additionalInfo = ` (${entry.messages} msgs, ${Math.floor((entry.voiceTime || 0) / 3600)}h voice)`;
    }
    
    leaderboardText += `${rankEmoji} **#${entry.rank}** ${username}\n`;
    leaderboardText += `   ${displayValue}${additionalInfo}\n\n`;
  }

  embed.addFields({
    name: `📊 Top ${type === 'xp' ? 'XP' : typeInfo.name}`,
    value: leaderboardText || 'No data available',
    inline: false
  });

  return embed;
}

function createNavigationComponents(
  type: string, 
  currentPage: number, 
  totalPages: number,
  totalUsers: number
): ActionRowBuilder<ButtonBuilder>[] {
  if (totalPages <= 1) return [];

  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  // Navigation row
  const navRow = new ActionRowBuilder<ButtonBuilder>();

  // Previous page button
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`leaderboard:${type}:${Math.max(1, currentPage - 1)}`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 1)
  );

  // Page info button (disabled, just for display)
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId('page_info')
      .setLabel(`${currentPage}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  // Next page button
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`leaderboard:${type}:${Math.min(totalPages, currentPage + 1)}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === totalPages)
  );

  components.push(navRow);

  // Type selector row
  const typeRow = new ActionRowBuilder<ButtonBuilder>();

  leaderboardTypes.forEach(typeOption => {
    typeRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`leaderboard:${typeOption.value}:1`)
        .setLabel(typeOption.name)
        .setStyle(type === typeOption.value ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(type === typeOption.value)
    );
  });

  components.push(typeRow);

  return components;
}

function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    case 4:
    case 5: return '🏅';
    default: return '▪️';
  }
}

function formatValue(value: number, type: string): string {
  switch (type) {
    case 'xp':
      return `${value.toLocaleString()} XP`;
    case 'messages':
      return `${value.toLocaleString()} messages`;
    case 'voice':
      const hours = Math.floor(value / 3600);
      const minutes = Math.floor((value % 3600) / 60);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes}m`;
      }
    case 'activity':
      return `${value.toLocaleString()} activity score`;
    default:
      return value.toLocaleString();
  }
}

export default command;