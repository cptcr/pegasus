// src/commands/community/avatar.ts - Avatar Display Community Command
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: 'avatar',
  description: 'Display a user\'s avatar in full resolution',
  category: 'community',
  usage: '/avatar [user]',
  examples: [
    '/avatar',
    '/avatar @user',
    '/avatar user:JohnDoe'
  ],
  aliases: ['av', 'pfp'],
  cooldown: 3,
  guildOnly: false
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Display a user\'s avatar in full resolution')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user whose avatar to display')
        .setRequired(false)),
  category: 'community',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild ? await interaction.guild.members.fetch(targetUser.id).catch(() => null) : null;

    // Get different avatar URLs
    const globalAvatar = targetUser.displayAvatarURL({ size: 4096, extension: 'png' });
    const serverAvatar = member?.displayAvatarURL({ size: 4096, extension: 'png' });
    
    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.username}'s Avatar`)
      .setColor(member?.displayHexColor || Config.COLORS.PRIMARY)
      .setImage(serverAvatar || globalAvatar)
      .setFooter({ 
        text: targetUser.id,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    // Add user info
    embed.addFields({
      name: '👤 User Info',
      value: `**Username:** ${targetUser.username}\n**ID:** ${targetUser.id}\n**Created:** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
      inline: true
    });

    if (member) {
      embed.addFields({
        name: '🏠 Server Info',
        value: `**Nickname:** ${member.nickname || 'None'}\n**Joined:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:R>\n**Roles:** ${member.roles.cache.size - 1}`,
        inline: true
      });
    }

    // Create buttons for different avatar types
    const row = new ActionRowBuilder<ButtonBuilder>();

    // Global avatar button
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Global Avatar')
        .setStyle(ButtonStyle.Link)
        .setURL(globalAvatar)
        .setEmoji('🌍')
    );

    // Server avatar button (if different from global)
    if (serverAvatar && serverAvatar !== globalAvatar) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Server Avatar')
          .setStyle(ButtonStyle.Link)
          .setURL(serverAvatar)
          .setEmoji('🏠')
      );
    }

    // Add animated avatar button if available
    if (targetUser.avatar && targetUser.avatar.startsWith('a_')) {
      const animatedAvatar = targetUser.displayAvatarURL({ size: 4096, extension: 'gif' });
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Animated')
          .setStyle(ButtonStyle.Link)
          .setURL(animatedAvatar)
          .setEmoji('🎬')
      );
    }

    // Banner button if available
    if (targetUser.banner) {
      const bannerUrl = targetUser.bannerURL({ size: 4096, extension: 'png' });
      if (bannerUrl) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel('Banner')
            .setStyle(ButtonStyle.Link)
            .setURL(bannerUrl)
            .setEmoji('🖼️')
        );
      }
    }

    const components = row.components.length > 0 ? [row] : [];

    await interaction.reply({ 
      embeds: [embed], 
      components 
    });

    // Log for community engagement stats
    if (interaction.guild) {
      client.wsManager.emitRealtimeEvent(interaction.guild.id, 'community:avatar_viewed', {
        viewerId: interaction.user.id,
        targetId: targetUser.id,
        targetUsername: targetUser.username
      });
    }

    client.logger.debug(`${interaction.user.tag} viewed avatar of ${targetUser.tag}`);
  }
};

export default command;