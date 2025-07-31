import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { premiumHandler } from '../../handlers/premium';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/helpers';

export const data = new SlashCommandBuilder()
  .setName('premium')
  .setDescription('Manage premium features (Bot Admin Only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('grant')
      .setDescription('Grant premium access to this server')
      .addStringOption(option =>
        option.setName('tier')
          .setDescription('Premium tier to grant')
          .setRequired(true)
          .addChoices(
            { name: 'Premium', value: 'premium' },
            { name: 'Enterprise', value: 'enterprise' }
          )
      )
      .addIntegerOption(option =>
        option.setName('days')
          .setDescription('Number of days (0 for permanent)')
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(365)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('revoke')
      .setDescription('Revoke premium access from this server')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Check premium status of this server')
  )
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  // Bot admin check (you can modify this to check specific user IDs)
  const botAdmins = ['REPLACE_WITH_YOUR_USER_ID']; // Replace with actual admin user IDs
  
  if (!botAdmins.includes(interaction.user.id)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Access Denied', 'This command is only available to bot administrators.')],
      ephemeral: true
    });
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'grant':
      await handleGrant(interaction);
      break;
    case 'revoke':
      await handleRevoke(interaction);
      break;
    case 'status':
      await handleStatus(interaction);
      break;
  }
}

async function handleGrant(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const tier = interaction.options.getString('tier', true);
  const days = interaction.options.getInteger('days') || 0;
  
  let expiresAt: Date | undefined;
  if (days > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
  }

  const success = await premiumHandler.grantPremium(
    interaction.guild.id,
    tier,
    interaction.user.id,
    expiresAt
  );

  if (success) {
    const embed = createSuccessEmbed(
      '✅ Premium Granted',
      `Successfully granted ${tier} access to this server!`
    );
    
    if (expiresAt) {
      embed.addFields([{
        name: '⏰ Expires',
        value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`,
        inline: true
      }]);
    } else {
      embed.addFields([{
        name: '⏰ Duration',
        value: 'Permanent',
        inline: true
      }]);
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to grant premium access.')],
      ephemeral: true
    });
  }
}

async function handleRevoke(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  // Set premium to basic (effectively removing premium)
  const success = await premiumHandler.grantPremium(
    interaction.guild.id,
    'basic',
    interaction.user.id
  );

  if (success) {
    await interaction.reply({
      embeds: [createSuccessEmbed('✅ Premium Revoked', 'Premium access has been revoked from this server.')],
      ephemeral: true
    });
  } else {
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to revoke premium access.')],
      ephemeral: true
    });
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const premiumInfo = await premiumHandler.getPremiumInfo(interaction.guild.id);

  const embed = createSuccessEmbed('🔍 Premium Status', 'Current premium information for this server');
  
  embed.addFields([
    {
      name: '🎫 Tier',
      value: premiumInfo.tier.charAt(0).toUpperCase() + premiumInfo.tier.slice(1),
      inline: true
    },
    {
      name: '✨ Premium Active',
      value: premiumInfo.isPremium ? 'Yes' : 'No',
      inline: true
    },
    {
      name: '📊 Custom Commands',
      value: `${premiumInfo.currentCustomCommands}/${premiumInfo.maxCustomCommands}`,
      inline: true
    },
    {
      name: '🎯 Features',
      value: premiumInfo.features.length > 0 ? premiumInfo.features.map((f: any) => `• ${f.replace('_', ' ')}`).join('\n') : 'None',
      inline: false
    }
  ]);

  if (premiumInfo.expiresAt) {
    embed.addFields([{
      name: '⏰ Expires',
      value: `<t:${Math.floor(new Date(premiumInfo.expiresAt).getTime() / 1000)}:R>`,
      inline: true
    }]);
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}