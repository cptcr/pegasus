// src/modules/voice/Join2CreateManager.ts - Join to Create Voice Channel System
import {
  Guild,
  VoiceChannel,
  CategoryChannel,
  TextChannel,
  PermissionFlagsBits,
  ChannelType,
  GuildMember,
  VoiceState,
  Collection,
  User,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../../utils/Logger.js';
import { Config } from '../../config/Config.js';
import { ExtendedClient } from '../../index.js';

export interface Join2CreateOptions {
  categoryId: string;
  channelName?: string;
  userLimit?: number;
  bitrate?: number;
}

export interface Join2CreateSettings {
  defaultUserLimit?: number;
  defaultBitrate?: number;
  channelNameTemplate?: string;
  allowTextChannel?: boolean;
  autoDeleteEmpty?: boolean;
  lockEmptyChannels?: boolean;
}

export interface TemporaryChannel {
  id: string;
  ownerId: string;
  guildId: string;
  voiceChannelId: string;
  textChannelId?: string;
  createdAt: Date;
  locked: boolean;
}

export class Join2CreateManager {
  private client: ExtendedClient;
  private db: PrismaClient;
  private logger: Logger;
  private temporaryChannels: Map<string, TemporaryChannel> = new Map();
  private blacklist: Map<string, Set<string>> = new Map(); // guildId -> Set<userId>

  constructor(client: ExtendedClient, db: PrismaClient, logger: Logger) {
    this.client = client;
    this.db = db;
    this.logger = logger;

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Setup Join to Create system for a guild
   */
  async setupJoin2Create(guild: Guild, options: Join2CreateOptions): Promise<{ success: boolean; channel?: VoiceChannel; error?: string }> {
    try {
      // Get or create category
      const category = guild.channels.cache.get(options.categoryId) as CategoryChannel;
      if (!category || category.type !== ChannelType.GuildCategory) {
        return { success: false, error: 'Invalid category' };
      }

      // Create Join to Create channel
      const j2cChannel = await guild.channels.create({
        name: options.channelName || '➕ Join to Create',
        type: ChannelType.GuildVoice,
        parent: category,
        userLimit: 0, // Always 0 for the join channel
        bitrate: options.bitrate || 64000,
        reason: 'Join to Create setup'
      });

      // Update guild settings
      await this.db.guild.update({
        where: { id: guild.id },
        data: {
          enableJoinToCreate: true,
          joinToCreateChannelId: j2cChannel.id,
          joinToCreateCategoryId: category.id
        }
      });

      // Store default settings
      await this.storeDefaultSettings(guild.id, {
        defaultUserLimit: options.userLimit || 0,
        defaultBitrate: options.bitrate || 64000,
        channelNameTemplate: "{user}'s Channel",
        allowTextChannel: false,
        autoDeleteEmpty: true,
        lockEmptyChannels: false
      });

      this.logger.info(`Join to Create setup for guild ${guild.name} (${guild.id})`);

      return { success: true, channel: j2cChannel };

    } catch (error) {
      this.logger.error('Error setting up Join to Create:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Disable Join to Create system
   */
  async disableJoin2Create(guildId: string): Promise<{ success: boolean; cleanedChannels?: number; error?: string }> {
    try {
      // Get guild settings
      const settings = await this.db.guild.findUnique({
        where: { id: guildId }
      });

      if (!settings || !settings.enableJoinToCreate) {
        return { success: false, error: 'Join to Create is not enabled' };
      }

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      // Delete Join to Create channel
      if (settings.joinToCreateChannelId) {
        const j2cChannel = guild.channels.cache.get(settings.joinToCreateChannelId);
        if (j2cChannel) {
          await j2cChannel.delete('Join to Create disabled').catch(() => {});
        }
      }

      // Clean up temporary channels
      const cleaned = await this.cleanupChannels(guildId);

      // Update guild settings
      await this.db.guild.update({
        where: { id: guildId },
        data: {
          enableJoinToCreate: false,
          joinToCreateChannelId: null,
          joinToCreateCategoryId: null
        }
      });

      // Clear stored settings
      await this.clearStoredSettings(guildId);

      this.logger.info(`Join to Create disabled for guild ${guildId}`);

      return { success: true, cleanedChannels: cleaned.cleanedChannels || 0 };

    } catch (error) {
      this.logger.error('Error disabling Join to Create:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Handle voice state update (user joining/leaving channels)
   */
  async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    try {
      // User joined a channel
      if (newState.channel && !oldState.channel) {
        await this.handleUserJoinChannel(newState);
      }
      // User left a channel
      else if (oldState.channel && !newState.channel) {
        await this.handleUserLeaveChannel(oldState);
      }
      // User switched channels
      else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        await this.handleUserLeaveChannel(oldState);
        await this.handleUserJoinChannel(newState);
      }
    } catch (error) {
      this.logger.error('Error handling voice state update:', error);
    }
  }

  /**
   * Handle user joining a channel
   */
  private async handleUserJoinChannel(state: VoiceState): Promise<void> {
    if (!state.guild || !state.member || !state.channel) return;

    const settings = await this.db.guild.findUnique({
      where: { id: state.guild.id }
    });

    if (!settings || !settings.enableJoinToCreate || !settings.joinToCreateChannelId) return;

    // Check if user joined the Join to Create channel
    if (state.channel.id === settings.joinToCreateChannelId) {
      // Check blacklist
      if (await this.isBlacklisted(state.guild.id, state.member.id)) {
        // Move user out of the channel
        await state.member.voice.disconnect('Blacklisted from Join to Create');
        
        try {
          await state.member.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🚫 Access Denied')
                .setDescription('You are blacklisted from using Join to Create in this server.')
                .setColor(Config.COLORS.ERROR)
                .setTimestamp()
            ]
          });
        } catch (error) {
          this.logger.warn('Failed to send blacklist DM:', error);
        }
        return;
      }

      // Create temporary channel
      await this.createTemporaryChannel(state.guild, state.member);
    }
  }

  /**
   * Handle user leaving a channel
   */
  private async handleUserLeaveChannel(state: VoiceState): Promise<void> {
    if (!state.guild || !state.channel) return;

    // Check if this is a temporary channel
    const tempChannel = this.temporaryChannels.get(state.channel.id);
    if (!tempChannel) return;

    // Get current channel
    const channel = state.guild.channels.cache.get(state.channel.id) as VoiceChannel;
    if (!channel) return;

    const j2cSettings = await this.getStoredSettings(state.guild.id);

    // Check if channel is empty
    if (channel.members.size === 0) {
      if (j2cSettings?.autoDeleteEmpty) {
        // Delete empty channel
        await this.deleteTemporaryChannel(state.guild, tempChannel);
      } else if (j2cSettings?.lockEmptyChannels) {
        // Lock empty channel
        await this.lockTemporaryChannel(channel, tempChannel);
      }
    }
  }

  /**
   * Create a temporary voice channel for a user
   */
  private async createTemporaryChannel(guild: Guild, member: GuildMember): Promise<void> {
    try {
      const settings = await this.db.guild.findUnique({
        where: { id: guild.id }
      });

      if (!settings || !settings.joinToCreateCategoryId) return;

      const j2cSettings = await this.getStoredSettings(guild.id);
      const category = guild.channels.cache.get(settings.joinToCreateCategoryId) as CategoryChannel;
      
      if (!category) return;

      // Generate channel name
      const channelName = this.generateChannelName(member, j2cSettings?.channelNameTemplate);

      // Create voice channel
      const voiceChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: category,
        userLimit: j2cSettings?.defaultUserLimit || 0,
        bitrate: j2cSettings?.defaultBitrate || 64000,
        permissionOverwrites: [
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.Stream,
              PermissionFlagsBits.UseVAD,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.MuteMembers,
              PermissionFlagsBits.DeafenMembers
            ]
          }
        ],
        reason: `Temporary channel for ${member.user.tag}`
      });

      // Create text channel if enabled
      let textChannel: TextChannel | undefined;
      if (j2cSettings?.allowTextChannel) {
        textChannel = await guild.channels.create({
          name: `💬-${channelName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          type: ChannelType.GuildText,
          parent: category,
          permissionOverwrites: [
            {
              id: guild.roles.everyone,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages
              ]
            }
          ],
          reason: `Text channel for ${member.user.tag}'s voice channel`
        });

        // Send welcome message
        await textChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('🎤 Welcome to your temporary channel!')
              .setDescription(`This text channel is linked to <#${voiceChannel.id}>.\nOnly members in the voice channel can see this.`)
              .addFields(
                { name: 'Channel Owner', value: `${member}`, inline: true },
                { name: 'Commands', value: 'Use the buttons below to manage your channel', inline: true }
              )
              .setColor(Config.COLORS.INFO)
              .setTimestamp()
          ],
          components: [this.createChannelControlPanel(voiceChannel.id)]
        });
      }

      // Move user to new channel
      await member.voice.setChannel(voiceChannel);

      // Store temporary channel info
      const tempChannel: TemporaryChannel = {
        id: voiceChannel.id,
        ownerId: member.id,
        guildId: guild.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: textChannel?.id,
        createdAt: new Date(),
        locked: false
      };

      this.temporaryChannels.set(voiceChannel.id, tempChannel);

      // Send confirmation DM
      try {
        await member.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('🎤 Temporary Channel Created')
              .setDescription(`Your temporary voice channel has been created in **${guild.name}**!`)
              .addFields(
                { name: 'Channel', value: `<#${voiceChannel.id}>`, inline: true },
                { name: 'Permissions', value: 'You have full control over this channel', inline: true }
              )
              .setColor(Config.COLORS.SUCCESS)
              .setTimestamp()
          ]
        });
      } catch (error) {
        this.logger.warn('Failed to send channel creation DM:', error);
      }

      this.logger.info(`Created temporary channel for ${member.user.tag} in ${guild.name}`);

    } catch (error) {
      this.logger.error('Error creating temporary channel:', error);
    }
  }

  /**
   * Delete a temporary channel
   */
  private async deleteTemporaryChannel(guild: Guild, tempChannel: TemporaryChannel): Promise<void> {
    try {
      // Delete voice channel
      const voiceChannel = guild.channels.cache.get(tempChannel.voiceChannelId);
      if (voiceChannel) {
        await voiceChannel.delete('Temporary channel cleanup');
      }

      // Delete text channel if exists
      if (tempChannel.textChannelId) {
        const textChannel = guild.channels.cache.get(tempChannel.textChannelId);
        if (textChannel) {
          await textChannel.delete('Temporary channel cleanup');
        }
      }

      // Remove from temporary channels map
      this.temporaryChannels.delete(tempChannel.id);

      this.logger.info(`Deleted temporary channel ${tempChannel.id} in ${guild.name}`);

    } catch (error) {
      this.logger.error('Error deleting temporary channel:', error);
    }
  }

  /**
   * Lock a temporary channel
   */
  private async lockTemporaryChannel(channel: VoiceChannel, tempChannel: TemporaryChannel): Promise<void> {
    try {
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
        Connect: false
      });

      tempChannel.locked = true;

      this.logger.info(`Locked temporary channel ${channel.id}`);

    } catch (error) {
      this.logger.error('Error locking temporary channel:', error);
    }
  }

  /**
   * Generate channel name from template
   */
  private generateChannelName(member: GuildMember, template?: string): string {
    const defaultTemplate = "{user}'s Channel";
    const nameTemplate = template || defaultTemplate;

    return nameTemplate
      .replace('{user}', member.displayName)
      .replace('{username}', member.user.username)
      .replace('{tag}', member.user.tag)
      .replace('{id}', member.id)
      .replace('{count}', (this.temporaryChannels.size + 1).toString());
  }

  /**
   * Create channel control panel
   */
  private createChannelControlPanel(channelId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`j2c_lock_${channelId}`)
          .setLabel('Lock/Unlock')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔒'),
        new ButtonBuilder()
          .setCustomId(`j2c_limit_${channelId}`)
          .setLabel('User Limit')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👥'),
        new ButtonBuilder()
          .setCustomId(`j2c_name_${channelId}`)
          .setLabel('Rename')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✏️'),
        new ButtonBuilder()
          .setCustomId(`j2c_region_${channelId}`)
          .setLabel('Region')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🌍'),
        new ButtonBuilder()
          .setCustomId(`j2c_delete_${channelId}`)
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️')
      );
  }

  /**
   * Handle button interactions for channel controls
   */
  async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    try {
      const [, action, channelId] = interaction.customId.split('_');
      const tempChannel = this.temporaryChannels.get(channelId);

      if (!tempChannel || tempChannel.ownerId !== interaction.user.id) {
        await interaction.reply({ 
          content: 'You do not have permission to manage this channel.', 
          ephemeral: true 
        });
        return;
      }

      const voiceChannel = interaction.guild?.channels.cache.get(channelId) as VoiceChannel;
      if (!voiceChannel) {
        await interaction.reply({ 
          content: 'Channel not found.', 
          ephemeral: true 
        });
        return;
      }

      switch (action) {
        case 'lock':
          await this.handleLockToggle(interaction, voiceChannel, tempChannel);
          break;
        case 'limit':
          await this.handleUserLimit(interaction, voiceChannel);
          break;
        case 'name':
          await this.handleRename(interaction, voiceChannel);
          break;
        case 'region':
          await this.handleRegion(interaction, voiceChannel);
          break;
        case 'delete':
          await this.handleDelete(interaction, tempChannel);
          break;
      }
    } catch (error) {
      this.logger.error('Error handling button interaction:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'An error occurred while processing your request.', 
          ephemeral: true 
        });
      }
    }
  }

  /**
   * Handle lock/unlock toggle
   */
  private async handleLockToggle(interaction: ButtonInteraction, channel: VoiceChannel, tempChannel: TemporaryChannel): Promise<void> {
    const isLocked = tempChannel.locked;
    
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
      Connect: !isLocked ? false : null
    });

    tempChannel.locked = !isLocked;

    await interaction.reply({
      content: `Channel ${!isLocked ? 'locked' : 'unlocked'} successfully!`,
      ephemeral: true
    });
  }

  /**
   * Handle user limit change
   */
  private async handleUserLimit(interaction: ButtonInteraction, channel: VoiceChannel): Promise<void> {
    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`j2c_limit_select_${channel.id}`)
          .setPlaceholder('Select user limit')
          .addOptions([
            { label: 'No Limit', value: '0', emoji: '♾️' },
            { label: '2 Users', value: '2', emoji: '2️⃣' },
            { label: '3 Users', value: '3', emoji: '3️⃣' },
            { label: '4 Users', value: '4', emoji: '4️⃣' },
            { label: '5 Users', value: '5', emoji: '5️⃣' },
            { label: '6 Users', value: '6', emoji: '6️⃣' },
            { label: '8 Users', value: '8', emoji: '8️⃣' },
            { label: '10 Users', value: '10', emoji: '🔟' },
            { label: 'Custom', value: 'custom', emoji: '✏️' }
          ])
      );

    await interaction.reply({
      content: 'Select a user limit for your channel:',
      components: [row],
      ephemeral: true
    });
  }

  /**
   * Handle rename
   */
  private async handleRename(interaction: ButtonInteraction, channel: VoiceChannel): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(`j2c_rename_modal_${channel.id}`)
      .setTitle('Rename Channel')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>()
          .addComponents(
            new TextInputBuilder()
              .setCustomId('channel_name')
              .setLabel('New Channel Name')
              .setStyle(TextInputStyle.Short)
              .setMaxLength(100)
              .setRequired(true)
              .setValue(channel.name)
          )
      );

    await interaction.showModal(modal);
  }

  /**
   * Handle region change
   */
  private async handleRegion(interaction: ButtonInteraction, channel: VoiceChannel): Promise<void> {
    const regions = [
      { label: 'Automatic', value: 'auto', emoji: '🌐' },
      { label: 'Brazil', value: 'brazil', emoji: '🇧🇷' },
      { label: 'Hong Kong', value: 'hongkong', emoji: '🇭🇰' },
      { label: 'India', value: 'india', emoji: '🇮🇳' },
      { label: 'Japan', value: 'japan', emoji: '🇯🇵' },
      { label: 'Rotterdam', value: 'rotterdam', emoji: '🇳🇱' },
      { label: 'Russia', value: 'russia', emoji: '🇷🇺' },
      { label: 'Singapore', value: 'singapore', emoji: '🇸🇬' },
      { label: 'South Africa', value: 'southafrica', emoji: '🇿🇦' },
      { label: 'Sydney', value: 'sydney', emoji: '🇦🇺' },
      { label: 'US Central', value: 'us-central', emoji: '🇺🇸' },
      { label: 'US East', value: 'us-east', emoji: '🇺🇸' },
      { label: 'US South', value: 'us-south', emoji: '🇺🇸' },
      { label: 'US West', value: 'us-west', emoji: '🇺🇸' }
    ];

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`j2c_region_select_${channel.id}`)
          .setPlaceholder('Select a region')
          .addOptions(regions.slice(0, 25)) // Discord limit
      );

    await interaction.reply({
      content: 'Select a region for your channel:',
      components: [row],
      ephemeral: true
    });
  }

  /**
   * Handle delete
   */
  private async handleDelete(interaction: ButtonInteraction, tempChannel: TemporaryChannel): Promise<void> {
    await interaction.reply({
      content: 'Deleting your channel...',
      ephemeral: true
    });

    const guild = this.client.guilds.cache.get(tempChannel.guildId);
    if (guild) {
      await this.deleteTemporaryChannel(guild, tempChannel);
    }
  }

  /**
   * Handle select menu interactions
   */
  async handleSelectMenuInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
      const [, action, , channelId] = interaction.customId.split('_');
      const tempChannel = this.temporaryChannels.get(channelId);

      if (!tempChannel || tempChannel.ownerId !== interaction.user.id) {
        await interaction.reply({ 
          content: 'You do not have permission to manage this channel.', 
          ephemeral: true 
        });
        return;
      }

      const voiceChannel = interaction.guild?.channels.cache.get(channelId) as VoiceChannel;
      if (!voiceChannel) {
        await interaction.reply({ 
          content: 'Channel not found.', 
          ephemeral: true 
        });
        return;
      }

      const value = interaction.values[0];

      if (action === 'limit') {
        if (value === 'custom') {
          // Show modal for custom limit
          const modal = new ModalBuilder()
            .setCustomId(`j2c_limit_modal_${channelId}`)
            .setTitle('Set User Limit')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>()
                .addComponents(
                  new TextInputBuilder()
                    .setCustomId('user_limit')
                    .setLabel('User Limit (0-99, 0 = no limit)')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(2)
                    .setRequired(true)
                    .setValue(voiceChannel.userLimit.toString())
                )
            );

          await interaction.showModal(modal);
        } else {
          const limit = parseInt(value);
          await voiceChannel.setUserLimit(limit);
          await interaction.reply({
            content: `User limit set to ${limit === 0 ? 'unlimited' : limit}!`,
            ephemeral: true
          });
        }
      } else if (action === 'region') {
        await voiceChannel.setRTCRegion(value === 'auto' ? null : value);
        await interaction.reply({
          content: `Region updated successfully!`,
          ephemeral: true
        });
      }
    } catch (error) {
      this.logger.error('Error handling select menu interaction:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'An error occurred while processing your request.', 
          ephemeral: true 
        });
      }
    }
  }

  /**
   * Handle modal submissions
   */
  async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const [, action, , channelId] = interaction.customId.split('_');
      const tempChannel = this.temporaryChannels.get(channelId);

      if (!tempChannel || tempChannel.ownerId !== interaction.user.id) {
        await interaction.reply({ 
          content: 'You do not have permission to manage this channel.', 
          ephemeral: true 
        });
        return;
      }

      const voiceChannel = interaction.guild?.channels.cache.get(channelId) as VoiceChannel;
      if (!voiceChannel) {
        await interaction.reply({ 
          content: 'Channel not found.', 
          ephemeral: true 
        });
        return;
      }

      if (action === 'rename') {
        const newName = interaction.fields.getTextInputValue('channel_name');
        await voiceChannel.setName(newName);
        await interaction.reply({
          content: `Channel renamed to **${newName}**!`,
          ephemeral: true
        });
      } else if (action === 'limit') {
        const limitStr = interaction.fields.getTextInputValue('user_limit');
        const limit = parseInt(limitStr);
        
        if (isNaN(limit) || limit < 0 || limit > 99) {
          await interaction.reply({
            content: 'Invalid user limit. Please enter a number between 0 and 99.',
            ephemeral: true
          });
          return;
        }

        await voiceChannel.setUserLimit(limit);
        await interaction.reply({
          content: `User limit set to ${limit === 0 ? 'unlimited' : limit}!`,
          ephemeral: true
        });
      }
    } catch (error) {
      this.logger.error('Error handling modal submit:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'An error occurred while processing your request.', 
          ephemeral: true 
        });
      }
    }
  }

  /**
   * Update Join to Create settings
   */
  async updateSettings(guildId: string, settings: Join2CreateSettings): Promise<{ success: boolean; error?: string }> {
    try {
      await this.storeSettings(guildId, settings);
      return { success: true };
    } catch (error) {
      this.logger.error('Error updating settings:', error);
      return { success: false, error: 'Failed to update settings' };
    }
  }

  /**
   * Get Join to Create settings
   */
  async getSettings(guildId: string): Promise<any> {
    const guildSettings = await this.db.guild.findUnique({
      where: { id: guildId }
    });

    if (!guildSettings) return null;

    const j2cSettings = await this.getStoredSettings(guildId);

    return {
      ...guildSettings,
      ...j2cSettings
    };
  }

  /**
   * Add user to blacklist
   */
  async addToBlacklist(guildId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.blacklist.has(guildId)) {
        this.blacklist.set(guildId, new Set());
      }

      const guildBlacklist = this.blacklist.get(guildId)!;
      
      if (guildBlacklist.has(userId)) {
        return { success: false, error: 'User is already blacklisted' };
      }

      guildBlacklist.add(userId);
      await this.saveBlacklist(guildId, guildBlacklist);

      return { success: true };
    } catch (error) {
      this.logger.error('Error adding to blacklist:', error);
      return { success: false, error: 'Failed to add to blacklist' };
    }
  }

  /**
   * Remove user from blacklist
   */
  async removeFromBlacklist(guildId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const guildBlacklist = this.blacklist.get(guildId);
      
      if (!guildBlacklist || !guildBlacklist.has(userId)) {
        return { success: false, error: 'User is not blacklisted' };
      }

      guildBlacklist.delete(userId);
      await this.saveBlacklist(guildId, guildBlacklist);

      return { success: true };
    } catch (error) {
      this.logger.error('Error removing from blacklist:', error);
      return { success: false, error: 'Failed to remove from blacklist' };
    }
  }

  /**
   * Get blacklist for a guild
   */
  async getBlacklist(guildId: string): Promise<string[]> {
    try {
      await this.loadBlacklist(guildId);
      const guildBlacklist = this.blacklist.get(guildId);
      return guildBlacklist ? Array.from(guildBlacklist) : [];
    } catch (error) {
      this.logger.error('Error getting blacklist:', error);
      return [];
    }
  }

  /**
   * Check if user is blacklisted
   */
  async isBlacklisted(guildId: string, userId: string): Promise<boolean> {
    try {
      await this.loadBlacklist(guildId);
      const guildBlacklist = this.blacklist.get(guildId);
      return guildBlacklist ? guildBlacklist.has(userId) : false;
    } catch (error) {
      this.logger.error('Error checking blacklist:', error);
      return false;
    }
  }

  /**
   * Clean up all temporary channels for a guild
   */
  async cleanupChannels(guildId: string): Promise<{ success: boolean; cleanedChannels?: number; error?: string }> {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      let cleaned = 0;
      const channelsToDelete = Array.from(this.temporaryChannels.values())
        .filter(ch => ch.guildId === guildId);

      for (const tempChannel of channelsToDelete) {
        await this.deleteTemporaryChannel(guild, tempChannel);
        cleaned++;
      }

      return { success: true, cleanedChannels: cleaned };
    } catch (error) {
      this.logger.error('Error cleaning up channels:', error);
      return { success: false, error: 'Failed to cleanup channels' };
    }
  }

  /**
   * Get active temporary channels for a guild
   */
  async getActiveChannels(guildId: string): Promise<TemporaryChannel[]> {
    return Array.from(this.temporaryChannels.values())
      .filter(ch => ch.guildId === guildId);
  }

  /**
   * Store Join to Create settings
   */
  private async storeSettings(guildId: string, settings: Join2CreateSettings): Promise<void> {
    const key = `j2c_settings_${guildId}`;
    await this.db.$executeRaw`
      INSERT INTO key_value_store (key, value)
      VALUES (${key}, ${JSON.stringify(settings)}::jsonb)
      ON CONFLICT (key)
      DO UPDATE SET value = ${JSON.stringify(settings)}::jsonb
    `;
  }

  /**
   * Store default settings
   */
  private async storeDefaultSettings(guildId: string, settings: Join2CreateSettings): Promise<void> {
    await this.storeSettings(guildId, settings);
  }

  /**
   * Get stored settings
   */
  private async getStoredSettings(guildId: string): Promise<Join2CreateSettings | null> {
    const key = `j2c_settings_${guildId}`;
    const result = await this.db.$queryRaw<any[]>`
      SELECT value FROM key_value_store WHERE key = ${key}
    `;
    return result.length > 0 ? result[0].value : null;
  }

  /**
   * Clear stored settings
   */
  private async clearStoredSettings(guildId: string): Promise<void> {
    const key = `j2c_settings_${guildId}`;
    await this.db.$executeRaw`
      DELETE FROM key_value_store WHERE key = ${key}
    `;
  }

  /**
   * Save blacklist to database
   */
  private async saveBlacklist(guildId: string, blacklist: Set<string>): Promise<void> {
    const key = `j2c_blacklist_${guildId}`;
    await this.db.$executeRaw`
      INSERT INTO key_value_store (key, value)
      VALUES (${key}, ${JSON.stringify(Array.from(blacklist))}::jsonb)
      ON CONFLICT (key)
      DO UPDATE SET value = ${JSON.stringify(Array.from(blacklist))}::jsonb
    `;
  }

  /**
   * Load blacklist from database
   */
  private async loadBlacklist(guildId: string): Promise<void> {
    if (this.blacklist.has(guildId)) return;

    const key = `j2c_blacklist_${guildId}`;
    const result = await this.db.$queryRaw<any[]>`
      SELECT value FROM key_value_store WHERE key = ${key}
    `;
    
    if (result.length > 0) {
      this.blacklist.set(guildId, new Set(result[0].value));
    } else {
      this.blacklist.set(guildId, new Set());
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    setInterval(async () => {
      try {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const [channelId, tempChannel] of this.temporaryChannels) {
          const age = now - tempChannel.createdAt.getTime();
          
          if (age > maxAge) {
            const guild = this.client.guilds.cache.get(tempChannel.guildId);
            if (guild) {
              const channel = guild.channels.cache.get(channelId);
              if (!channel || (channel instanceof VoiceChannel && channel.members.size === 0)) {
                await this.deleteTemporaryChannel(guild, tempChannel);
              }
            }
          }
        }
      } catch (error) {
        this.logger.error('Error in cleanup interval:', error);
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Initialize Join to Create for a guild
   */
  async initializeGuild(guild: Guild): Promise<void> {
    try {
      const settings = await this.db.guild.findUnique({
        where: { id: guild.id }
      });

      if (!settings || !settings.enableJoinToCreate) return;

      // Load blacklist
      await this.loadBlacklist(guild.id);

      // Find existing temporary channels
      if (settings.joinToCreateCategoryId) {
        const category = guild.channels.cache.get(settings.joinToCreateCategoryId);
        if (category && category.type === ChannelType.GuildCategory) {
          const voiceChannels = guild.channels.cache.filter(ch => 
            ch.type === ChannelType.GuildVoice && 
            ch.parentId === category.id &&
            ch.id !== settings.joinToCreateChannelId
          );

          // Restore temporary channels
          for (const [, channel] of voiceChannels) {
            if (channel instanceof VoiceChannel && channel.members.size > 0) {
              const owner = channel.members.first();
              if (owner) {
                const tempChannel: TemporaryChannel = {
                  id: channel.id,
                  ownerId: owner.id,
                  guildId: guild.id,
                  voiceChannelId: channel.id,
                  createdAt: new Date(),
                  locked: false
                };
                this.temporaryChannels.set(channel.id, tempChannel);
              }
            }
          }
        }
      }

      this.logger.info(`Initialized Join to Create for guild ${guild.name}`);

    } catch (error) {
      this.logger.error('Error initializing Join to Create for guild:', error);
    }
  }
}