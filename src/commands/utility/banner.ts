import { SlashCommandBuilder, EmbedBuilder, User, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/helpers';
import { emojis, colors } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('banner')
  .setDescription('Display user or server banners')
  .addSubcommand(subcommand =>
    subcommand
      .setName('user')
      .setDescription('Display a user\'s banner')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to display banner for')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('size')
          .setDescription('Banner size')
          .setRequired(false)
          .addChoices(
            { name: '300x100', value: '300' },
            { name: '600x200', value: '600' },
            { name: '1024x341', value: '1024' },
            { name: '2048x683', value: '2048' },
            { name: '4096x1365', value: '4096' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('server')
      .setDescription('Display the server\'s banner')
      .addStringOption(option =>
        option.setName('size')
          .setDescription('Banner size')
          .setRequired(false)
          .addChoices(
            { name: '300x100', value: '300' },
            { name: '600x200', value: '600' },
            { name: '1024x341', value: '1024' },
            { name: '2048x683', value: '2048' },
            { name: '4096x1365', value: '4096' }
          )
      )
  )
  .setDMPermission(false);

export async function execute(interaction: any) {
  const subcommand = interaction.options.getSubcommand();
  const size = parseInt(interaction.options.getString('size') || '1024');

  try {
    if (subcommand === 'user') {
      await handleUserBanner(interaction, size);
    } else if (subcommand === 'server') {
      await handleServerBanner(interaction, size);
    }
  } catch (error) {
    console.error('Error in banner command:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to fetch banner. Please try again.')],
      ephemeral: true,
    });
  }
}

async function handleUserBanner(interaction: any, size: number) {
  const targetUser = interaction.options.getUser('user') || interaction.user;

  try {
    // Fetch user with force to get banner data
    const user = await interaction.client.users.fetch(targetUser.id, { force: true });

    if (!user.bannerURL()) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', `${user.username} doesn't have a banner set.`)],
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.banner} ${user.username}'s Banner`)
      .setColor(user.accentColor || colors.primary)
      .setImage(user.bannerURL({ size: size as any, extension: 'png' }))
      .setTimestamp();

    const bannerInfo = [
      `**Username:** ${user.username}`,
      `**Display Name:** ${user.displayName}`,
      `**User ID:** \`${user.id}\``,
      `**Banner Size:** ${size}x${Math.floor(size / 3)}`,
      `**Banner ID:** \`${user.banner}\``,
      `**Animated:** ${user.banner?.startsWith('a_') ? 'Yes' : 'No'}`
    ];

    if (user.accentColor) {
      bannerInfo.push(`**Accent Color:** #${user.accentColor.toString(16).padStart(6, '0')}`);
    }

    embed.addFields({
      name: '📋 Banner Information',
      value: bannerInfo.join('\n'),
      inline: true
    });

    // Create download buttons
    const row = new ActionRowBuilder<ButtonBuilder>();
    const formats = ['png', 'jpg', 'webp'];
    
    if (user.banner?.startsWith('a_')) {
      formats.push('gif');
    }

    formats.forEach((format, index) => {
      if (index < 5) { // Discord button limit
        row.addComponents(
          new ButtonBuilder()
            .setLabel(format.toUpperCase())
            .setURL(user.bannerURL({ size: 4096 as any, extension: format as any })!)
            .setStyle(ButtonStyle.Link)
        );
      }
    });

    await interaction.reply({ embeds: [embed], components: [row] });

  } catch (error) {
    console.error('Error fetching user banner:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to fetch user banner. The user might not exist or doesn\'t have a banner.')],
      ephemeral: true,
    });
  }
}

async function handleServerBanner(interaction: any, size: number) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  try {
    const guild = await interaction.guild.fetch();

    if (!guild.bannerURL()) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'This server doesn\'t have a banner set.')],
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.banner} ${guild.name}'s Banner`)
      .setColor(colors.primary)
      .setImage(guild.bannerURL({ size: size as any, extension: 'png' }))
      .setTimestamp();

    const bannerInfo = [
      `**Server Name:** ${guild.name}`,
      `**Server ID:** \`${guild.id}\``,
      `**Banner Size:** ${size}x${Math.floor(size / 3)}`,
      `**Banner ID:** \`${guild.banner}\``,
      `**Animated:** ${guild.banner?.startsWith('a_') ? 'Yes' : 'No'}`,
      `**Boost Tier:** ${guild.premiumTier}`,
      `**Member Count:** ${guild.memberCount}`
    ];

    embed.addFields({
      name: '📋 Server Information',
      value: bannerInfo.join('\n'),
      inline: true
    });

    // Server features related to banners
    const bannerFeatures = [];
    if (guild.features.includes('BANNER')) bannerFeatures.push('✅ Banner');
    if (guild.features.includes('ANIMATED_BANNER')) bannerFeatures.push('✅ Animated Banner');
    if (guild.features.includes('INVITE_SPLASH')) bannerFeatures.push('✅ Invite Splash');

    if (bannerFeatures.length > 0) {
      embed.addFields({
        name: '🎨 Banner Features',
        value: bannerFeatures.join('\n'),
        inline: true
      });
    }

    // Create download buttons
    const row = new ActionRowBuilder<ButtonBuilder>();
    const formats = ['png', 'jpg', 'webp'];
    
    if (guild.banner?.startsWith('a_')) {
      formats.push('gif');
    }

    formats.forEach((format, index) => {
      if (index < 5) { // Discord button limit
        row.addComponents(
          new ButtonBuilder()
            .setLabel(format.toUpperCase())
            .setURL(guild.bannerURL({ size: 4096 as any, extension: format as any })!)
            .setStyle(ButtonStyle.Link)
        );
      }
    });

    // Add additional server media buttons if available
    const mediaRow = new ActionRowBuilder<ButtonBuilder>();
    
    if (guild.iconURL()) {
      mediaRow.addComponents(
        new ButtonBuilder()
          .setLabel('Server Icon')
          .setURL(guild.iconURL({ size: 4096 as any })!)
          .setStyle(ButtonStyle.Link)
          .setEmoji(emojis.server)
      );
    }

    if (guild.splashURL()) {
      mediaRow.addComponents(
        new ButtonBuilder()
          .setLabel('Invite Splash')
          .setURL(guild.splashURL({ size: 4096 as any })!)
          .setStyle(ButtonStyle.Link)
          .setEmoji('🎨')
      );
    }

    const components = [row];
    if (mediaRow.components.length > 0) {
      components.push(mediaRow);
    }

    await interaction.reply({ embeds: [embed], components });

  } catch (error) {
    console.error('Error fetching server banner:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to fetch server banner. Please try again.')],
      ephemeral: true,
    });
  }
}