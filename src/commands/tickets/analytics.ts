import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ticketAnalytics } from '../../handlers/ticketAnalytics';
import { createErrorEmbed } from '../../utils/helpers';

export const command = {
  data: new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('View comprehensive ticket system analytics and reports')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName('period')
        .setDescription('Time period for analytics')
        .setRequired(false)
        .addChoices(
          { name: 'Last 24 Hours', value: 'daily' },
          { name: 'Last 7 Days', value: 'weekly' },
          { name: 'Last 30 Days', value: 'monthly' },
          { name: 'Last 365 Days', value: 'yearly' }
        )
    )
    .addStringOption(option =>
      option
        .setName('view')
        .setDescription('Specific analytics view')
        .setRequired(false)
        .addChoices(
          { name: 'Overview Dashboard', value: 'overview' },
          { name: 'Staff Performance', value: 'staff' },
          { name: 'Trend Analysis', value: 'trends' },
          { name: 'Category Statistics', value: 'categories' }
        )
    ),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
        ephemeral: true
      });
      return;
    }

    const period = interaction.options.getString('period') as 'daily' | 'weekly' | 'monthly' | 'yearly' || 'monthly';
    const view = interaction.options.getString('view') || 'overview';

    if (view === 'overview') {
      // Use the interactive analytics system
      await ticketAnalytics.handleAnalyticsCommand(interaction);
    } else {
      // Generate specific analytics view
      await generateSpecificView(interaction, period, view);
    }
  },
};

async function generateSpecificView(interaction: CommandInteraction, period: 'daily' | 'weekly' | 'monthly' | 'yearly', view: string) {
  if (!interaction.guild) return;

  await interaction.deferReply();

  try {
    const analytics = await ticketAnalytics.generateAnalytics(interaction.guild.id, period);
    
    switch (view) {
      case 'staff':
        await ticketAnalytics.handleStaffDetails({
          ...interaction,
          customId: `analytics_staff_${period}`,
          editReply: interaction.editReply.bind(interaction)
        } as any, period);
        break;
      
      case 'trends':
        await ticketAnalytics.handleTrendsView({
          ...interaction,
          customId: `analytics_trends_${period}`,
          editReply: interaction.editReply.bind(interaction)
        } as any, period);
        break;
      
      case 'categories':
        const embeds = await ticketAnalytics.createAnalyticsDashboard(interaction.guild, analytics, period);
        // Show only the distribution embed
        const distributionEmbed = embeds.find(embed => embed.data.title?.includes('Distribution'));
        if (distributionEmbed) {
          await interaction.editReply({ embeds: [distributionEmbed] });
        } else {
          await interaction.editReply({ embeds: [embeds[0]] });
        }
        break;
      
      default:
        const dashboardEmbeds = await ticketAnalytics.createAnalyticsDashboard(interaction.guild, analytics, period);
        await interaction.editReply({ embeds: dashboardEmbeds });
        break;
    }
  } catch (error) {
    console.error('Error generating analytics view:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to generate analytics. Please try again.')]
    });
  }
}