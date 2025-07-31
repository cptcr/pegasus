import { SlashCommandBuilder, EmbedBuilder, User, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/helpers';
import { emojis, colors } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('avatar')
  .setDescription('Display user or server avatars')
  .addSubcommand(subcommand =>
    subcommand
      .setName('user')
      .setDescription('Display a user\'s avatar')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to display avatar for')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('size')
          .setDescription('Avatar size')
          .setRequired(false)
          .addChoices(
            { name: '16x16', value: '16' },
            { name: '32x32', value: '32' },
            { name: '64x64', value: '64' },
            { name: '128x128', value: '128' },
            { name: '256x256', value: '256' },
            { name: '512x512', value: '512' },
            { name: '1024x1024', value: '1024' },
            { name: '2048x2048', value: '2048' },
            { name: '4096x4096', value: '4096' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('server')
      .setDescription('Display the server\'s icon')
      .addStringOption(option =>
        option.setName('size')
          .setDescription('Icon size')
          .setRequired(false)
          .addChoices(
            { name: '16x16', value: '16' },
            { name: '32x32', value: '32' },
            { name: '64x64', value: '64' },
            { name: '128x128', value: '128' },
            { name: '256x256', value: '256' },
            { name: '512x512', value: '512' },
            { name: '1024x1024', value: '1024' },
            { name: '2048x2048', value: '2048' },
            { name: '4096x4096', value: '4096' }
          )
      )
  )
  .setDMPermission(false);

export async function execute(interaction: any) {
  const subcommand = interaction.options.getSubcommand();
  const size = parseInt(interaction.options.getString('size') || '1024');

  try {
    if (subcommand === 'user') {
      await handleUserAvatar(interaction, size);
    } else if (subcommand === 'server') {
      await handleServerAvatar(interaction, size);
    }
  } catch (error) {
    console.error('Error in avatar command:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to fetch avatar. Please try again.')],
      ephemeral: true,
    });
  }
}

async function handleUserAvatar(interaction: any, size: number) {
  const targetUser = interaction.options.getUser('user') || interaction.user;

  try {
    const user = await interaction.client.users.fetch(targetUser.id, { force: true });
    let member: GuildMember | null = null;

    if (interaction.guild) {
      member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.avatar} ${user.username}'s Avatar`)
      .setColor(member?.displayHexColor || colors.primary)
      .setTimestamp();

    // Global avatar
    const globalAvatarURL = user.displayAvatarURL({ size: size as any, extension: 'png' });
    embed.setImage(globalAvatarURL);

    const avatarInfo = [
      `**Username:** ${user.username}`,
      `**Display Name:** ${user.displayName}`,
      `**User ID:** \`${user.id}\``,
      `**Avatar Size:** ${size}x${size}`,
    ];

    // Check if user has a custom avatar
    if (user.avatar) {
      avatarInfo.push(`**Avatar ID:** \`${user.avatar}\``);
      avatarInfo.push(`**Animated:** ${user.avatar.startsWith('a_') ? 'Yes' : 'No'}`);
    } else {
      avatarInfo.push(`**Avatar Type:** Default Discord Avatar`);
    }

    embed.addFields({
      name: '📋 Avatar Information',
      value: avatarInfo.join('\n'),
      inline: true
    });

    // Create download buttons
    const row = new ActionRowBuilder<ButtonBuilder>();

    // Global avatar formats
    const formats = ['png', 'jpg', 'webp'];
    if (user.avatar?.startsWith('a_')) {
      formats.push('gif');
    }

    formats.forEach((format, index) => {
      if (index < 5) { // Discord button limit
        row.addComponents(
          new ButtonBuilder()
            .setLabel(format.toUpperCase())
            .setURL(user.displayAvatarURL({ size: 4096 as any, extension: format as any }))
            .setStyle(ButtonStyle.Link)
        );
      }
    });

    // Server-specific avatar if available
    let serverAvatarEmbed: EmbedBuilder | null = null;
    if (member?.avatar) {
      serverAvatarEmbed = new EmbedBuilder()
        .setTitle(`${emojis.server} Server Avatar`)
        .setColor(member.displayHexColor || colors.primary)
        .setImage(member.displayAvatarURL({ size: size as any, extension: 'png' }))
        .addFields({
          name: '📋 Server Avatar Information',
          value: [
            `**Server:** ${interaction.guild.name}`,
            `**Avatar ID:** \`${member.avatar}\``,
            `**Animated:** ${member.avatar.startsWith('a_') ? 'Yes' : 'No'}`,
            `**Size:** ${size}x${size}`
          ].join('\n'),
          inline: true
        });

      // Add server avatar download buttons
      const serverFormats = ['png', 'jpg', 'webp'];
      if (member.avatar.startsWith('a_')) {
        serverFormats.push('gif');
      }

      const serverRow = new ActionRowBuilder<ButtonBuilder>();
      serverFormats.forEach((format, index) => {
        if (index < 5) {
          serverRow.addComponents(
            new ButtonBuilder()
              .setLabel(`Server ${format.toUpperCase()}`)
              .setURL(member!.displayAvatarURL({ size: 4096 as any, extension: format as any }))
              .setStyle(ButtonStyle.Link)
          );
        }
      });

      const embeds = [embed];
      const components = [row];

      if (serverAvatarEmbed) {
        embeds.push(serverAvatarEmbed);
        components.push(serverRow);
      }

      await interaction.reply({ embeds, components });
    } else {
      await interaction.reply({ embeds: [embed], components: [row] });
    }

  } catch (error) {
    console.error('Error fetching user avatar:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to fetch user avatar. The user might not exist.')],
      ephemeral: true,
    });
  }
}

async function handleServerAvatar(interaction: any, size: number) {
  if (!interaction.guild) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  try {
    const guild = await interaction.guild.fetch();

    if (!guild.iconURL()) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'This server doesn\'t have an icon set.')],
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.server} ${guild.name}'s Icon`)
      .setColor(colors.primary)
      .setImage(guild.iconURL({ size: size as any, extension: 'png' }))
      .setTimestamp();

    const iconInfo = [
      `**Server Name:** ${guild.name}`,
      `**Server ID:** \`${guild.id}\``,
      `**Icon Size:** ${size}x${size}`,
      `**Icon ID:** \`${guild.icon}\``,
      `**Animated:** ${guild.icon?.startsWith('a_') ? 'Yes' : 'No'}`,
      `**Member Count:** ${guild.memberCount}`
    ];

    embed.addFields({
      name: '📋 Server Information',
      value: iconInfo.join('\n'),
      inline: true
    });

    // Create download buttons
    const row = new ActionRowBuilder<ButtonBuilder>();
    const formats = ['png', 'jpg', 'webp'];
    
    if (guild.icon?.startsWith('a_')) {
      formats.push('gif');
    }

    formats.forEach((format, index) => {
      if (index < 5) { // Discord button limit
        row.addComponents(
          new ButtonBuilder()
            .setLabel(format.toUpperCase())
            .setURL(guild.iconURL({ size: 4096 as any, extension: format as any })!)
            .setStyle(ButtonStyle.Link)
        );
      }
    });

    await interaction.reply({ embeds: [embed], components: [row] });

  } catch (error) {
    console.error('Error fetching server icon:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to fetch server icon. Please try again.')],
      ephemeral: true,
    });
  }
}