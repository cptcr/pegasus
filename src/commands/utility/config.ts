import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/helpers';
import { db } from '../../database/connection';
import { xpHandler } from '../../handlers/xp';
import { joinToCreateHandler } from '../../handlers/joinToCreate';
import { loggingHandler } from '../../handlers/logging';

export const data = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings')
    .addSubcommandGroup(group =>
      group
        .setName('xp')
        .setDescription('Configure XP system')
        .addSubcommand(subcommand =>
          subcommand
            .setName('enable')
            .setDescription('Enable or disable XP system')
            .addBooleanOption(option =>
              option.setName('enabled')
                .setDescription('Enable XP system')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('rate')
            .setDescription('Set XP rate')
            .addIntegerOption(option =>
              option.setName('rate')
                .setDescription('XP rate (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('cooldown')
            .setDescription('Set XP cooldown')
            .addIntegerOption(option =>
              option.setName('seconds')
                .setDescription('Cooldown in seconds (1-300)')
                .setMinValue(1)
                .setMaxValue(300)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('levelup-channel')
            .setDescription('Set level up notification channel')
            .addChannelOption(option =>
              option.setName('channel')
                .setDescription('Channel for level up notifications')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('voice')
        .setDescription('Configure voice features')
        .addSubcommand(subcommand =>
          subcommand
            .setName('join-to-create')
            .setDescription('Set join to create channel')
            .addChannelOption(option =>
              option.setName('channel')
                .setDescription('Voice channel to join to create temp channels')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('temp-category')
            .setDescription('Set category for temporary channels')
            .addChannelOption(option =>
              option.setName('category')
                .setDescription('Category for temporary channels')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(false)
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('log-channel')
        .setDescription('Set logging channel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel for logging events')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current configuration')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) return;

  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  if (subcommandGroup === 'xp') {
    await handleXpConfig(interaction, subcommand);
  } else if (subcommandGroup === 'voice') {
    await handleVoiceConfig(interaction, subcommand);
  } else if (subcommand === 'log-channel') {
    await handleLogChannelConfig(interaction);
  } else if (subcommand === 'view') {
    await handleViewConfig(interaction);
  }
}

async function handleXpConfig(interaction: any, subcommand: string) {
    if (!interaction.guild) return;

    switch (subcommand) {
      case 'enable':
        const enabled = interaction.options.getBoolean('enabled', true);
        await xpHandler.setXpEnabled(interaction.guild.id, enabled);
        await interaction.reply({
          embeds: [createSuccessEmbed('XP System', `XP system has been ${enabled ? 'enabled' : 'disabled'}`)],
        });
        break;

      case 'rate':
        const rate = interaction.options.getInteger('rate', true);
        await xpHandler.setXpRate(interaction.guild.id, rate);
        await interaction.reply({
          embeds: [createSuccessEmbed('XP Rate', `XP rate has been set to ${rate}`)],
        });
        break;

      case 'cooldown':
        const cooldown = interaction.options.getInteger('seconds', true);
        await xpHandler.setXpCooldown(interaction.guild.id, cooldown);
        await interaction.reply({
          embeds: [createSuccessEmbed('XP Cooldown', `XP cooldown has been set to ${cooldown} seconds`)],
        });
        break;

      case 'levelup-channel':
        const channel = interaction.options.getChannel('channel');
        await xpHandler.setLevelUpChannel(interaction.guild.id, channel?.id || null);
        await interaction.reply({
          embeds: [createSuccessEmbed('Level Up Channel', 
            channel ? `Level up channel set to ${channel}` : 'Level up channel disabled')],
        });
        break;
    }
  }

async function handleVoiceConfig(interaction: any, subcommand: string) {
    if (!interaction.guild) return;

    switch (subcommand) {
      case 'join-to-create':
        const channel = interaction.options.getChannel('channel');
        await joinToCreateHandler.setJoinToCreateChannel(interaction.guild.id, channel?.id || null);
        await interaction.reply({
          embeds: [createSuccessEmbed('Join to Create', 
            channel ? `Join to create channel set to ${channel}` : 'Join to create disabled')],
        });
        break;

      case 'temp-category':
        const category = interaction.options.getChannel('category');
        await joinToCreateHandler.setJoinToCreateCategory(interaction.guild.id, category?.id || null);
        await interaction.reply({
          embeds: [createSuccessEmbed('Temp Category', 
            category ? `Temporary channel category set to ${category}` : 'Temporary category disabled')],
        });
        break;
    }
  }

async function handleLogChannelConfig(interaction: any) {
    if (!interaction.guild) return;

    const channel = interaction.options.getChannel('channel');
    await loggingHandler.setLogChannel(interaction.guild.id, channel?.id || null);
    await interaction.reply({
      embeds: [createSuccessEmbed('Log Channel', 
        channel ? `Log channel set to ${channel}` : 'Logging disabled')],
    });
  }

async function handleViewConfig(interaction: any) {
    if (!interaction.guild) return;

    await interaction.deferReply();

    const settings = await db.query(
      'SELECT * FROM guild_settings WHERE guild_id = $1',
      [interaction.guild.id]
    );

    const config = settings.rows[0] || {};

    const embed = createSuccessEmbed('Server Configuration', 'Current bot configuration for this server');

    embed.addFields(
      {
        name: 'XP System',
        value: `Enabled: ${config.xp_enabled ? 'Yes' : 'No'}\n` +
               `Rate: ${config.xp_rate || 15}\n` +
               `Cooldown: ${config.xp_cooldown || 60}s\n` +
               `Level Up Channel: ${config.level_up_channel ? `<#${config.level_up_channel}>` : 'None'}`,
        inline: true,
      },
      {
        name: 'Voice Features',
        value: `Join to Create: ${config.join_to_create_channel ? `<#${config.join_to_create_channel}>` : 'None'}\n` +
               `Temp Category: ${config.join_to_create_category ? `<#${config.join_to_create_category}>` : 'None'}`,
        inline: true,
      },
      {
        name: 'Logging',
        value: `Log Channel: ${config.log_channel ? `<#${config.log_channel}>` : 'None'}`,
        inline: true,
      },
      {
        name: 'Moderation',
        value: `Mute Role: ${config.mute_role ? `<@&${config.mute_role}>` : 'None'}\n` +
               `Mod Log: ${config.mod_log_channel ? `<#${config.mod_log_channel}>` : 'None'}`,
        inline: true,
      }
    );

    await interaction.editReply({ embeds: [embed] });
  }