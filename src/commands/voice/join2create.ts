// src/commands/voice/join2create.ts - Fixed Join2Create Command
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import { ExtendedClient } from '../../index.js';
import { Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('join2create')
    .setDescription('Manage Join to Create voice channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Setup Join to Create system')
        .addChannelOption(option =>
          option.setName('category')
            .setDescription('Category to create channels in')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Name for the join channel')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Default user limit for created channels')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(99)
        )
        .addIntegerOption(option =>
          option.setName('bitrate')
            .setDescription('Default bitrate for created channels (in kbps)')
            .setRequired(false)
            .setMinValue(8)
            .setMaxValue(384)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable Join to Create system')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('settings')
        .setDescription('View current Join to Create settings')
    ),
  category: 'voice',
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'setup': {
          const category = interaction.options.getChannel('category', true);
          const channelName = interaction.options.getString('name') || 'Join to Create';
          const userLimit = interaction.options.getInteger('limit') || 0;
          const bitrate = interaction.options.getInteger('bitrate') || 64;

          if (category.type !== ChannelType.GuildCategory) {
            await interaction.reply({
              content: '❌ Please select a valid category channel.',
              ephemeral: true
            });
            return;
          }

          await interaction.deferReply();

          const result = await client.j2cManager.setup(
            interaction.guild,
            category.id,
            channelName,
            userLimit,
            bitrate * 1000 // Convert to bps
          );

          if (result.success) {
            await interaction.editReply({
              content: `✅ Join to Create system has been set up!\n` +
                      `📂 Category: ${category.name}\n` +
                      `🔊 Join Channel: ${result.channel.name}\n` +
                      `👥 Default Limit: ${userLimit === 0 ? 'Unlimited' : userLimit}\n` +
                      `🎵 Default Bitrate: ${bitrate}kbps`
            });
          } else {
            await interaction.editReply({
              content: `❌ Failed to setup Join to Create: ${result.error}`
            });
          }
          break;
        }

        case 'disable': {
          await interaction.deferReply();

          const disableResult = await client.j2cManager.updateSettings(interaction.guild.id, { 
            isEnabled: false 
          });

          if (disableResult.success) {
            await interaction.editReply({
              content: '✅ Join to Create system has been disabled.'
            });
          } else {
            await interaction.editReply({
              content: '❌ Failed to disable Join to Create system.'
            });
          }
          break;
        }

        case 'settings': {
          await interaction.deferReply();

          const settings = await client.j2cManager.getSettings(interaction.guild.id);

          if (!settings) {
            await interaction.editReply({
              content: '❌ Join to Create system is not configured for this server.'
            });
            return;
          }

          const statusEmoji = settings.isEnabled ? '🟢' : '🔴';
          const statusText = settings.isEnabled ? 'Enabled' : 'Disabled';
          
          const category = settings.categoryId ? 
            interaction.guild.channels.cache.get(settings.categoryId) : null;
          const joinChannel = settings.joinChannelId ? 
            interaction.guild.channels.cache.get(settings.joinChannelId) : null;

          await interaction.editReply({
            content: `🔊 **Join to Create Settings**\n\n` +
                    `${statusEmoji} Status: **${statusText}**\n` +
                    `📂 Category: ${category ? category.name : 'Not found'}\n` +
                    `🚪 Join Channel: ${joinChannel ? joinChannel.name : 'Not found'}\n` +
                    `👥 Default User Limit: ${settings.defaultUserLimit === 0 ? 'Unlimited' : settings.defaultUserLimit}\n` +
                    `🎵 Default Bitrate: ${Math.round(settings.defaultBitrate / 1000)}kbps\n` +
                    `🧹 Auto Delete Empty: ${settings.autoDeleteEmpty ? 'Yes' : 'No'}\n` +
                    `🔒 Lock Empty Channels: ${settings.lockEmptyChannels ? 'Yes' : 'No'}`
          });
          break;
        }

        default:
          await interaction.reply({
            content: '❌ Unknown subcommand.',
            ephemeral: true
          });
      }
    } catch (error) {
      client.logger.error('❌ Error in join2create command:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing the command.',
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: '❌ An error occurred while processing the command.'
        });
      }
    }
  },
};

export default command;