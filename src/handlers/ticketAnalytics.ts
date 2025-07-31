// Ticket Analytics and Reporting System
import { 
  EmbedBuilder,
  Guild,
  User,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  CommandInteraction,
  ButtonInteraction,
  SelectMenuInteraction
} from 'discord.js';
import { db } from '../database/connection';
import { createEmbed, createSuccessEmbed } from '../utils/helpers';
import { colors } from '../utils/config';
import { i18n } from '../i18n';

export interface TicketAnalytics {
  // Overall metrics
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  claimedTickets: number;
  
  // Time-based metrics
  avgFirstResponseTime: number; // in minutes
  avgResolutionTime: number; // in minutes
  
  // Category distribution
  categoryDistribution: Record<string, number>;
  
  // Priority distribution
  priorityDistribution: Record<string, number>;
  
  // Staff performance
  staffMetrics: Array<{
    userId: string;
    username: string;
    ticketsClaimed: number;
    ticketsResolved: number;
    avgResponseTime: number;
    avgResolutionTime: number;
    satisfactionRating: number;
  }>;
  
  // Satisfaction metrics
  avgSatisfactionRating: number;
  satisfactionDistribution: Record<number, number>;
  
  // Activity trends
  dailyActivity: Array<{
    date: string;
    created: number;
    closed: number;
    claimed: number;
  }>;
  
  // Peak hours
  hourlyDistribution: Record<number, number>;
}

export class TicketAnalyticsHandler {
  private static instance: TicketAnalyticsHandler;

  public static getInstance(): TicketAnalyticsHandler {
    if (!TicketAnalyticsHandler.instance) {
      TicketAnalyticsHandler.instance = new TicketAnalyticsHandler();
    }
    return TicketAnalyticsHandler.instance;
  }

  // Generate comprehensive analytics for a guild
  public async generateAnalytics(guildId: string, period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly'): Promise<TicketAnalytics> {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'daily':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'yearly':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    // Get overall ticket metrics
    const overallMetrics = await db.query(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status != 'closed' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
        COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END) as claimed_tickets,
        AVG(CASE WHEN first_response_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (first_response_at - created_at))/60 END) as avg_first_response,
        AVG(CASE WHEN resolution_time_minutes IS NOT NULL THEN 
          resolution_time_minutes END) as avg_resolution_time,
        AVG(CASE WHEN satisfaction_rating IS NOT NULL THEN 
          satisfaction_rating END) as avg_satisfaction
      FROM tickets 
      WHERE guild_id = $1 AND created_at >= $2
    `, [guildId, startDate]);

    const metrics = overallMetrics.rows[0];

    // Get category distribution
    const categoryDist = await db.query(`
      SELECT tc.name, COUNT(t.id) as count
      FROM tickets t
      LEFT JOIN ticket_categories tc ON t.category_id = tc.id
      WHERE t.guild_id = $1 AND t.created_at >= $2
      GROUP BY tc.name
      ORDER BY count DESC
    `, [guildId, startDate]);

    // Get priority distribution
    const priorityDist = await db.query(`
      SELECT priority, COUNT(*) as count
      FROM tickets
      WHERE guild_id = $1 AND created_at >= $2
      GROUP BY priority
      ORDER BY count DESC
    `, [guildId, startDate]);

    // Get staff performance metrics
    const staffMetrics = await db.query(`
      SELECT 
        u.user_id,
        COUNT(CASE WHEN t.assigned_to = u.user_id THEN 1 END) as tickets_claimed,
        COUNT(CASE WHEN t.closed_by = u.user_id THEN 1 END) as tickets_resolved,
        AVG(CASE WHEN t.assigned_to = u.user_id AND t.first_response_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/60 END) as avg_response_time,
        AVG(CASE WHEN t.closed_by = u.user_id AND t.resolution_time_minutes IS NOT NULL THEN 
          t.resolution_time_minutes END) as avg_resolution_time,
        AVG(CASE WHEN t.assigned_to = u.user_id AND t.satisfaction_rating IS NOT NULL THEN 
          t.satisfaction_rating END) as avg_satisfaction
      FROM (
        SELECT DISTINCT assigned_to as user_id FROM tickets WHERE guild_id = $1 AND assigned_to IS NOT NULL
        UNION
        SELECT DISTINCT closed_by FROM tickets WHERE guild_id = $1 AND closed_by IS NOT NULL AND closed_by != 'system'
      ) u
      LEFT JOIN tickets t ON (t.assigned_to = u.user_id OR t.closed_by = u.user_id) 
        AND t.guild_id = $1 AND t.created_at >= $2
      GROUP BY u.user_id
      HAVING COUNT(t.id) > 0
      ORDER BY tickets_claimed DESC, tickets_resolved DESC
    `, [guildId, startDate]);

    // Get satisfaction distribution
    const satisfactionDist = await db.query(`
      SELECT satisfaction_rating, COUNT(*) as count
      FROM tickets
      WHERE guild_id = $1 AND satisfaction_rating IS NOT NULL AND created_at >= $2
      GROUP BY satisfaction_rating
      ORDER BY satisfaction_rating
    `, [guildId, startDate]);

    // Get daily activity for the period
    const dailyActivity = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(CASE WHEN created_at IS NOT NULL THEN 1 END) as created,
        COUNT(CASE WHEN closed_at IS NOT NULL THEN 1 END) as closed,
        COUNT(CASE WHEN claimed_at IS NOT NULL THEN 1 END) as claimed
      FROM tickets
      WHERE guild_id = $1 AND created_at >= $2
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [guildId, startDate]);

    // Get hourly distribution for peak hours analysis
    const hourlyDist = await db.query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as count
      FROM tickets
      WHERE guild_id = $1 AND created_at >= $2
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, [guildId, startDate]);

    // Format results
    const categoryDistribution: Record<string, number> = {};
    categoryDist.rows.forEach(row => {
      categoryDistribution[row.name || 'Uncategorized'] = parseInt(row.count);
    });

    const priorityDistribution: Record<string, number> = {};
    priorityDist.rows.forEach(row => {
      priorityDistribution[row.priority] = parseInt(row.count);
    });

    const staffPerformance = staffMetrics.rows.map(row => ({
      userId: row.user_id,
      username: `<@${row.user_id}>`, // Will be resolved in display
      ticketsClaimed: parseInt(row.tickets_claimed || 0),
      ticketsResolved: parseInt(row.tickets_resolved || 0),
      avgResponseTime: parseFloat(row.avg_response_time || 0),
      avgResolutionTime: parseFloat(row.avg_resolution_time || 0),
      satisfactionRating: parseFloat(row.avg_satisfaction || 0)
    }));

    const satisfactionDistribution: Record<number, number> = {};
    satisfactionDist.rows.forEach(row => {
      satisfactionDistribution[parseInt(row.satisfaction_rating)] = parseInt(row.count);
    });

    const hourlyDistribution: Record<number, number> = {};
    hourlyDist.rows.forEach(row => {
      hourlyDistribution[parseInt(row.hour)] = parseInt(row.count);
    });

    return {
      totalTickets: parseInt(metrics.total_tickets || 0),
      openTickets: parseInt(metrics.open_tickets || 0),
      closedTickets: parseInt(metrics.closed_tickets || 0),
      claimedTickets: parseInt(metrics.claimed_tickets || 0),
      avgFirstResponseTime: parseFloat(metrics.avg_first_response || 0),
      avgResolutionTime: parseFloat(metrics.avg_resolution_time || 0),
      categoryDistribution,
      priorityDistribution,
      staffMetrics: staffPerformance,
      avgSatisfactionRating: parseFloat(metrics.avg_satisfaction || 0),
      satisfactionDistribution,
      dailyActivity: dailyActivity.rows.map(row => ({
        date: row.date,
        created: parseInt(row.created),
        closed: parseInt(row.closed),
        claimed: parseInt(row.claimed)
      })),
      hourlyDistribution
    };
  }

  // Create analytics dashboard embed
  public async createAnalyticsDashboard(guild: Guild, analytics: TicketAnalytics, period: string): Promise<EmbedBuilder[]> {
    const embeds: EmbedBuilder[] = [];

    // Main overview embed
    const overviewEmbed = new EmbedBuilder()
      .setTitle(`📊 Ticket Analytics Dashboard - ${period.charAt(0).toUpperCase() + period.slice(1)}`)
      .setDescription(`Analytics overview for **${guild.name}**`)
      .setColor(colors.primary)
      .addFields(
        {
          name: '🎫 Total Tickets',
          value: analytics.totalTickets.toLocaleString(),
          inline: true
        },
        {
          name: '🟢 Open Tickets',
          value: analytics.openTickets.toLocaleString(),
          inline: true
        },
        {
          name: '🔒 Closed Tickets',
          value: analytics.closedTickets.toLocaleString(),
          inline: true
        },
        {
          name: '👤 Claimed Tickets',
          value: analytics.claimedTickets.toLocaleString(),
          inline: true
        },
        {
          name: '⚡ Avg First Response',
          value: this.formatDuration(analytics.avgFirstResponseTime * 60),
          inline: true
        },
        {
          name: '⏱️ Avg Resolution Time',
          value: this.formatDuration(analytics.avgResolutionTime * 60),
          inline: true
        }
      )
      .setTimestamp();

    if (analytics.avgSatisfactionRating > 0) {
      const stars = '⭐'.repeat(Math.floor(analytics.avgSatisfactionRating)) + 
                   (analytics.avgSatisfactionRating % 1 >= 0.5 ? '⭐' : '');
      overviewEmbed.addFields({
        name: '⭐ Customer Satisfaction',
        value: `${analytics.avgSatisfactionRating.toFixed(1)}/5 ${stars}`,
        inline: true
      });
    }

    embeds.push(overviewEmbed);

    // Category and Priority Distribution
    if (Object.keys(analytics.categoryDistribution).length > 0 || Object.keys(analytics.priorityDistribution).length > 0) {
      const distributionEmbed = new EmbedBuilder()
        .setTitle('📈 Distribution Analysis')
        .setColor(colors.secondary);

      if (Object.keys(analytics.categoryDistribution).length > 0) {
        const categoryText = Object.entries(analytics.categoryDistribution)
          .map(([category, count]) => `**${category}:** ${count} tickets`)
          .join('\n');
        distributionEmbed.addFields({
          name: '📁 Category Distribution',
          value: categoryText,
          inline: true
        });
      }

      if (Object.keys(analytics.priorityDistribution).length > 0) {
        const priorityEmojis = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' };
        const priorityText = Object.entries(analytics.priorityDistribution)
          .map(([priority, count]) => {
            const emoji = priorityEmojis[priority as keyof typeof priorityEmojis] || '⚪';
            return `${emoji} **${priority.charAt(0).toUpperCase() + priority.slice(1)}:** ${count}`;
          })
          .join('\n');
        distributionEmbed.addFields({
          name: '🎯 Priority Distribution',
          value: priorityText,
          inline: true
        });
      }

      embeds.push(distributionEmbed);
    }

    // Staff Performance
    if (analytics.staffMetrics.length > 0) {
      const staffEmbed = new EmbedBuilder()
        .setTitle('👥 Staff Performance')
        .setColor(colors.success)
        .setDescription('Top performing staff members based on ticket activity');

      // Top 10 staff members
      const topStaff = analytics.staffMetrics.slice(0, 10);
      for (const staff of topStaff) {
        const responseTime = staff.avgResponseTime > 0 ? this.formatDuration(staff.avgResponseTime * 60) : 'N/A';
        const resolutionTime = staff.avgResolutionTime > 0 ? this.formatDuration(staff.avgResolutionTime * 60) : 'N/A';
        const satisfaction = staff.satisfactionRating > 0 ? `${staff.satisfactionRating.toFixed(1)}/5` : 'N/A';

        staffEmbed.addFields({
          name: `${staff.username}`,
          value: `**Claimed:** ${staff.ticketsClaimed} | **Resolved:** ${staff.ticketsResolved}\n` +
                 `**Avg Response:** ${responseTime} | **Satisfaction:** ${satisfaction}`,
          inline: false
        });
      }

      embeds.push(staffEmbed);
    }

    // Daily Activity Trends
    if (analytics.dailyActivity.length > 0) {
      const activityEmbed = new EmbedBuilder()
        .setTitle('📅 Daily Activity Trends')
        .setColor(colors.warning)
        .setDescription('Ticket activity over the selected period');

      const recentActivity = analytics.dailyActivity.slice(0, 7); // Last 7 days
      const activityText = recentActivity
        .map(day => {
          const date = new Date(day.date).toLocaleDateString();
          return `**${date}:** ${day.created} created | ${day.closed} closed | ${day.claimed} claimed`;
        })
        .join('\n');

      activityEmbed.addFields({
        name: '📊 Recent Activity',
        value: activityText || 'No activity data available',
        inline: false
      });

      // Peak hours analysis
      if (Object.keys(analytics.hourlyDistribution).length > 0) {
        const peakHour = Object.entries(analytics.hourlyDistribution)
          .reduce((max, [hour, count]) => count > max.count ? { hour: parseInt(hour), count } : max, 
                  { hour: 0, count: 0 });

        activityEmbed.addFields({
          name: '🕐 Peak Hour',
          value: `${peakHour.hour}:00 - ${peakHour.hour + 1}:00 (${peakHour.count} tickets)`,
          inline: true
        });
      }

      embeds.push(activityEmbed);
    }

    return embeds;
  }

  // Handle analytics command interactions
  public async handleAnalyticsCommand(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) return;

    await interaction.deferReply();

    try {
      // Create period selection menu
      const periodSelect = new StringSelectMenuBuilder()
        .setCustomId('analytics_period_select')
        .setPlaceholder('Select time period for analytics')
        .addOptions([
          {
            label: 'Last 24 Hours',
            description: 'Analytics for the past day',
            value: 'daily',
            emoji: '📅'
          },
          {
            label: 'Last 7 Days',
            description: 'Analytics for the past week',
            value: 'weekly',
            emoji: '📊'
          },
          {
            label: 'Last 30 Days',
            description: 'Analytics for the past month',
            value: 'monthly',
            emoji: '📈'
          },
          {
            label: 'Last 365 Days',
            description: 'Analytics for the past year',
            value: 'yearly',
            emoji: '📉'
          }
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(periodSelect);

      const embed = createEmbed({
        title: '📊 Ticket Analytics',
        description: 'Select a time period to view detailed analytics for your ticket system.',
        color: colors.primary,
      });

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Error handling analytics command:', error);
      await interaction.editReply({
        embeds: [createEmbed({
          title: 'Error',
          description: 'Failed to load analytics. Please try again.',
          color: colors.error
        })]
      });
    }
  }

  public async handlePeriodSelection(interaction: SelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;

    const period = interaction.values[0] as 'daily' | 'weekly' | 'monthly' | 'yearly';

    await interaction.deferUpdate();

    try {
      const analytics = await this.generateAnalytics(interaction.guild.id, period);
      const embeds = await this.createAnalyticsDashboard(interaction.guild, analytics, period);

      // Create navigation buttons for detailed views
      const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`analytics_export_${period}`)
            .setLabel('Export Data')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📁'),
          new ButtonBuilder()
            .setCustomId(`analytics_staff_${period}`)
            .setLabel('Staff Details')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👥'),
          new ButtonBuilder()
            .setCustomId(`analytics_trends_${period}`)
            .setLabel('Trends')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📈'),
          new ButtonBuilder()
            .setCustomId('analytics_period_select')
            .setLabel('Change Period')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄')
        );

      await interaction.editReply({
        embeds,
        components: [buttons]
      });

    } catch (error) {
      console.error('Error generating analytics:', error);
      await interaction.editReply({
        embeds: [createEmbed({
          title: 'Error',
          description: 'Failed to generate analytics. Please try again.',
          color: colors.error
        })],
        components: []
      });
    }
  }

  public async handleAnalyticsButtons(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;
    
    if (customId === 'analytics_period_select') {
      // Re-show period selection
      await this.handleAnalyticsCommand(interaction as any);
      return;
    }

    const parts = customId.split('_');
    const action = parts[1];
    const period = parts[2] as 'daily' | 'weekly' | 'monthly' | 'yearly';

    await interaction.deferReply({ ephemeral: true });

    try {
      switch (action) {
        case 'export':
          await this.handleDataExport(interaction, period);
          break;
        case 'staff':
          await this.handleStaffDetails(interaction, period);
          break;
        case 'trends':
          await this.handleTrendsView(interaction, period);
          break;
      }
    } catch (error) {
      console.error('Error handling analytics button:', error);
      await interaction.editReply({
        embeds: [createEmbed({
          title: 'Error',
          description: 'Failed to process your request. Please try again.',
          color: colors.error
        })]
      });
    }
  }

  private async handleDataExport(interaction: ButtonInteraction, period: 'daily' | 'weekly' | 'monthly' | 'yearly'): Promise<void> {
    if (!interaction.guild) return;

    const analytics = await this.generateAnalytics(interaction.guild.id, period);
    
    // Generate CSV data
    const csvData = this.generateCSVReport(analytics, period);
    
    const embed = createSuccessEmbed(
      '📁 Data Export Ready',
      `Analytics data for the ${period} period has been prepared.\n\n` +
      `**Total Tickets:** ${analytics.totalTickets}\n` +
      `**Period:** ${period}\n` +
      `**Generated:** ${new Date().toLocaleString()}`
    );

    // In a real implementation, you would create a file attachment here
    // For now, we'll just show the summary
    await interaction.editReply({
      embeds: [embed]
    });
  }

  private async handleStaffDetails(interaction: ButtonInteraction, period: 'daily' | 'weekly' | 'monthly' | 'yearly'): Promise<void> {
    if (!interaction.guild) return;

    const analytics = await this.generateAnalytics(interaction.guild.id, period);
    
    const staffEmbed = new EmbedBuilder()
      .setTitle(`👥 Detailed Staff Performance - ${period.charAt(0).toUpperCase() + period.slice(1)}`)
      .setColor(colors.primary)
      .setDescription(`Comprehensive staff metrics for **${interaction.guild.name}**`);

    if (analytics.staffMetrics.length === 0) {
      staffEmbed.setDescription('No staff activity found for this period.');
    } else {
      // Show top 15 staff members with detailed metrics
      const topStaff = analytics.staffMetrics.slice(0, 15);
      
      for (let i = 0; i < topStaff.length; i++) {
        const staff = topStaff[i];
        const rank = i + 1;
        const responseTime = staff.avgResponseTime > 0 ? this.formatDuration(staff.avgResponseTime * 60) : 'N/A';
        const resolutionTime = staff.avgResolutionTime > 0 ? this.formatDuration(staff.avgResolutionTime * 60) : 'N/A';
        const satisfaction = staff.satisfactionRating > 0 ? `${staff.satisfactionRating.toFixed(1)}/5 ⭐` : 'N/A';

        staffEmbed.addFields({
          name: `#${rank} ${staff.username}`,
          value: `🎫 **Claimed:** ${staff.ticketsClaimed} | **Resolved:** ${staff.ticketsResolved}\n` +
                 `⚡ **Response Time:** ${responseTime}\n` +
                 `⏱️ **Resolution Time:** ${resolutionTime}\n` +
                 `⭐ **Satisfaction:** ${satisfaction}`,
          inline: i % 2 === 0
        });
      }
    }

    await interaction.editReply({
      embeds: [staffEmbed]
    });
  }

  private async handleTrendsView(interaction: ButtonInteraction, period: 'daily' | 'weekly' | 'monthly' | 'yearly'): Promise<void> {
    if (!interaction.guild) return;

    const analytics = await this.generateAnalytics(interaction.guild.id, period);
    
    const trendsEmbed = new EmbedBuilder()
      .setTitle(`📈 Ticket Trends Analysis - ${period.charAt(0).toUpperCase() + period.slice(1)}`)
      .setColor(colors.warning)
      .setDescription(`Trend analysis for **${interaction.guild.name}**`);

    // Daily activity trends
    if (analytics.dailyActivity.length > 0) {
      const recentDays = analytics.dailyActivity.slice(0, 10);
      const trendText = recentDays
        .map(day => {
          const date = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const efficiency = day.closed > 0 ? Math.round((day.closed / day.created) * 100) : 0;
          return `**${date}:** ${day.created}↗️ ${day.closed}✅ (${efficiency}% resolved)`;
        })
        .join('\n');

      trendsEmbed.addFields({
        name: '📅 Daily Activity Trends',
        value: trendText,
        inline: false
      });
    }

    // Peak hours analysis
    if (Object.keys(analytics.hourlyDistribution).length > 0) {
      const sortedHours = Object.entries(analytics.hourlyDistribution)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      const peakHoursText = sortedHours
        .map(([hour, count], index) => {
          const emoji = index === 0 ? '🔥' : index === 1 ? '⚡' : '📊';
          const timeFormat = new Date(2000, 0, 1, parseInt(hour)).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            hour12: true 
          });
          return `${emoji} **${timeFormat}:** ${count} tickets`;
        })
        .join('\n');

      trendsEmbed.addFields({
        name: '🕐 Peak Hours',
        value: peakHoursText,
        inline: true
      });
    }

    // Category trends
    if (Object.keys(analytics.categoryDistribution).length > 0) {
      const topCategories = Object.entries(analytics.categoryDistribution)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      const categoryText = topCategories
        .map(([category, count], index) => {
          const percentage = Math.round((count / analytics.totalTickets) * 100);
          const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📋';
          return `${emoji} **${category}:** ${count} (${percentage}%)`;
        })
        .join('\n');

      trendsEmbed.addFields({
        name: '📁 Top Categories',
        value: categoryText,
        inline: true
      });
    }

    await interaction.editReply({
      embeds: [trendsEmbed]
    });
  }

  private generateCSVReport(analytics: TicketAnalytics, period: string): string {
    const rows = [
      ['Metric', 'Value'],
      ['Period', period],
      ['Total Tickets', analytics.totalTickets.toString()],
      ['Open Tickets', analytics.openTickets.toString()],
      ['Closed Tickets', analytics.closedTickets.toString()],
      ['Claimed Tickets', analytics.claimedTickets.toString()],
      ['Avg First Response Time (minutes)', analytics.avgFirstResponseTime.toString()],
      ['Avg Resolution Time (minutes)', analytics.avgResolutionTime.toString()],
      ['Avg Satisfaction Rating', analytics.avgSatisfactionRating.toString()],
      [''],
      ['Category Distribution'],
      ...Object.entries(analytics.categoryDistribution).map(([cat, count]) => [cat, count.toString()]),
      [''],
      ['Priority Distribution'],
      ...Object.entries(analytics.priorityDistribution).map(([pri, count]) => [pri, count.toString()]),
      [''],
      ['Staff Performance'],
      ['User ID', 'Tickets Claimed', 'Tickets Resolved', 'Avg Response Time', 'Avg Resolution Time', 'Satisfaction'],
      ...analytics.staffMetrics.map(staff => [
        staff.userId,
        staff.ticketsClaimed.toString(),
        staff.ticketsResolved.toString(),
        staff.avgResponseTime.toString(),
        staff.avgResolutionTime.toString(),
        staff.satisfactionRating.toString()
      ])
    ];

    return rows.map(row => row.join(',')).join('\n');
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours < 24) return `${hours}h ${minutes}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
}

export const ticketAnalytics = TicketAnalyticsHandler.getInstance();