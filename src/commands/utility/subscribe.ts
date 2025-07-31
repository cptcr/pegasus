import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} from 'discord.js';
import { monetizationHandler } from '../../handlers/monetization';
import { createSuccessEmbed, createErrorEmbed, createEmbed } from '../../utils/helpers';
import { colors, emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('subscribe')
  .setDescription('Manage custom commands subscription for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('purchase')
      .setDescription('Get the purchase link for custom commands subscription')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Check subscription status for this server')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('refresh')
      .setDescription('Refresh subscription status from Discord')
  )
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'purchase':
      await handlePurchase(interaction);
      break;
    case 'status':
      await handleStatus(interaction);
      break;
    case 'refresh':
      await handleRefresh(interaction);
      break;
  }
}

async function handlePurchase(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  // Check if already subscribed
  const isActive = await monetizationHandler.isGuildPremium(interaction.guild.id);
  
  if (isActive) {
    return interaction.reply({
      embeds: [createSuccessEmbed(
        '✅ Already Subscribed!',
        'This server already has an active custom commands subscription.'
      )],
      ephemeral: true
    });
  }

  const purchaseLink = monetizationHandler.generatePurchaseLink(interaction.guild.id);

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.crown} Custom Commands Subscription`)
    .setDescription(
      '🚀 **Unlock powerful custom commands for your server!**\n\n' +
      '**What you get:**\n' +
      '• Create unlimited custom subcommands\\n' +
      '• Rich embed responses with full customization\\n' +
      '• Plain text responses\\n' +
      '• Usage analytics and management tools\\n' +
      '• Priority support\n\n' +
      '**Monthly Subscription** - Cancel anytime through Discord'
    )
    .setColor(colors.primary as any)
    .addFields([
      {
        name: '💡 Examples',
        value: '• `/info rules` - Display server rules\\n• `/help support` - Show support information\\n• `/welcome newcomers` - Welcome message\\n• And much more!',
        inline: false
      },
      {
        name: '🔒 Secure Payment',
        value: 'Payments are processed securely through Discord\'s official monetization system.',
        inline: false
      }
    ])
    .setFooter({ text: 'Click the button below to subscribe through Discord' })
    .setTimestamp();

  const button = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Subscribe Now')
        .setURL(purchaseLink)
        .setStyle(ButtonStyle.Link)
        .setEmoji('💳')
    );

  await interaction.reply({
    embeds: [embed],
    components: [button],
    ephemeral: true
  });
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const subscriptionStatus = await monetizationHandler.getSubscriptionStatus(interaction.guild.id);
    const entitlementDetails = await monetizationHandler.getEntitlementDetails(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.info} Subscription Status`)
      .setColor(subscriptionStatus?.is_active ? colors.success as any : colors.error as any);

    if (!subscriptionStatus || !subscriptionStatus.is_active) {
      embed.setDescription('❌ **No Active Subscription**\n\nThis server does not have an active custom commands subscription.');
      
      embed.addFields([
        {
          name: '🚀 Get Started',
          value: 'Use `/subscribe purchase` to get a subscription link for this server.',
          inline: false
        }
      ]);

      if (entitlementDetails.length > 0) {
        const lastEntitlement = entitlementDetails[0];
        embed.addFields([
          {
            name: '📜 Previous Subscription',
            value: `Last active: <t:${Math.floor(new Date(lastEntitlement.ends_at || lastEntitlement.starts_at).getTime() / 1000)}:R>`,
            inline: false
          }
        ]);
      }
    } else {
      embed.setDescription('✅ **Active Subscription**\n\nThis server has an active custom commands subscription!');
      
      embed.addFields([
        {
          name: '📊 Status',
          value: subscriptionStatus.is_active ? '🟢 Active' : '🔴 Inactive',
          inline: true
        },
        {
          name: '🆔 Entitlement ID',
          value: subscriptionStatus.current_entitlement_id || 'Unknown',
          inline: true
        }
      ]);

      if (subscriptionStatus.expires_at) {
        embed.addFields([
          {
            name: '⏰ Expires',
            value: `<t:${Math.floor(subscriptionStatus.expires_at.getTime() / 1000)}:F>\n<t:${Math.floor(subscriptionStatus.expires_at.getTime() / 1000)}:R>`,
            inline: false
          }
        ]);
      } else {
        embed.addFields([
          {
            name: '⏰ Duration',
            value: 'Ongoing subscription (monthly billing)',
            inline: false
          }
        ]);
      }

      embed.addFields([
        {
          name: '🔄 Last Checked',
          value: `<t:${Math.floor(subscriptionStatus.last_checked.getTime() / 1000)}:R>`,
          inline: true
        }
      ]);
    }

    // Add SKU information
    embed.addFields([
      {
        name: '🏷️ Product Info',
        value: `**SKU ID:** \`1394971870528540682\`\n**Application ID:** \`1375140177961418774\``,
        inline: false
      }
    ]);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to retrieve subscription status. Please try again later.')]
    });
  }
}

async function handleRefresh(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    // Force update from Discord API
    await monetizationHandler.updateEntitlementsFromAPI(interaction.guild.id);

    const isActive = await monetizationHandler.isGuildPremium(interaction.guild.id);
    
    const embed = createSuccessEmbed(
      '🔄 Status Refreshed',
      `Subscription status has been updated from Discord's servers.\n\n**Current Status:** ${isActive ? '✅ Active' : '❌ Inactive'}`
    );

    if (isActive) {
      embed.addFields([
        {
          name: '💡 Next Steps',
          value: 'You can now use `/subcommand create` to start creating custom commands!',
          inline: false
        }
      ]);
    } else {
      embed.addFields([
        {
          name: '🚀 Get Subscription',
          value: 'Use `/subscribe purchase` to get a subscription for this server.',
          inline: false
        }
      ]);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error refreshing subscription:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to refresh subscription status. Please try again later.')]
    });
  }
}