import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, createEmbed } from '../../utils/helpers';
import { welcomeHandler } from '../../handlers/welcome';
import { colors, emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome and goodbye messages')
    .addSubcommandGroup(group =>
      group
        .setName('setup')
        .setDescription('Basic welcome/goodbye setup')
        .addSubcommand(subcommand =>
          subcommand
            .setName('welcome')
            .setDescription('Configure welcome messages')
            .addBooleanOption(option =>
              option.setName('enabled')
                .setDescription('Enable welcome messages')
                .setRequired(true)
            )
            .addChannelOption(option =>
              option.setName('channel')
                .setDescription('Channel for welcome messages')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
            .addStringOption(option =>
              option.setName('message')
                .setDescription('Welcome message (use {user}, {server}, {membercount} placeholders)')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('goodbye')
            .setDescription('Configure goodbye messages')
            .addBooleanOption(option =>
              option.setName('enabled')
                .setDescription('Enable goodbye messages')
                .setRequired(true)
            )
            .addChannelOption(option =>
              option.setName('channel')
                .setDescription('Channel for goodbye messages')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
            .addStringOption(option =>
              option.setName('message')
                .setDescription('Goodbye message (use {user}, {server} placeholders)')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('dm')
            .setDescription('Configure DM welcome messages')
            .addBooleanOption(option =>
              option.setName('enabled')
                .setDescription('Enable DM welcome messages')
                .setRequired(true)
            )
            .addStringOption(option =>
              option.setName('message')
                .setDescription('DM welcome message')
                .setRequired(false)
            )
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('card')
        .setDescription('Configure welcome cards and images')
        .addSubcommand(subcommand =>
          subcommand
            .setName('enable')
            .setDescription('Enable welcome cards')
            .addBooleanOption(option =>
              option.setName('enabled')
                .setDescription('Enable welcome cards')
                .setRequired(true)
            )
            .addStringOption(option =>
              option.setName('color')
                .setDescription('Card background color (hex code)')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('goodbye-image')
            .setDescription('Enable goodbye images')
            .addBooleanOption(option =>
              option.setName('enabled')
                .setDescription('Enable goodbye images')
                .setRequired(true)
            )
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('embed')
        .setDescription('Configure welcome embed settings')
        .addSubcommand(subcommand =>
          subcommand
            .setName('setup')
            .setDescription('Configure embed appearance')
            .addBooleanOption(option =>
              option.setName('enabled')
                .setDescription('Use embed for welcome messages')
                .setRequired(true)
            )
            .addStringOption(option =>
              option.setName('title')
                .setDescription('Embed title')
                .setRequired(false)
            )
            .addStringOption(option =>
              option.setName('description')
                .setDescription('Embed description')
                .setRequired(false)
            )
            .addStringOption(option =>
              option.setName('color')
                .setDescription('Embed color (hex code)')
                .setRequired(false)
            )
            .addStringOption(option =>
              option.setName('footer')
                .setDescription('Embed footer text')
                .setRequired(false)
            )
            .addBooleanOption(option =>
              option.setName('thumbnail')
                .setDescription('Show user avatar as thumbnail')
                .setRequired(false)
            )
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('autorole')
        .setDescription('Configure automatic roles')
        .addSubcommand(subcommand =>
          subcommand
            .setName('setup')
            .setDescription('Configure autoroles')
            .addBooleanOption(option =>
              option.setName('enabled')
                .setDescription('Enable autoroles')
                .setRequired(true)
            )
            .addRoleOption(option =>
              option.setName('role1')
                .setDescription('First autorole')
                .setRequired(false)
            )
            .addRoleOption(option =>
              option.setName('role2')
                .setDescription('Second autorole')
                .setRequired(false)
            )
            .addRoleOption(option =>
              option.setName('role3')
                .setDescription('Third autorole')
                .setRequired(false)
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('test')
        .setDescription('Test welcome/goodbye messages')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type of message to test')
            .setRequired(true)
            .addChoices(
              { name: 'Welcome', value: 'welcome' },
              { name: 'Goodbye', value: 'goodbye' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current welcome configuration')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) return;

  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  if (subcommandGroup === 'setup') {
    if (subcommand === 'welcome') {
      await handleWelcomeSetup(interaction);
    } else if (subcommand === 'goodbye') {
      await handleGoodbyeSetup(interaction);
    } else if (subcommand === 'dm') {
      await handleDMSetup(interaction);
    }
  } else if (subcommandGroup === 'card') {
    if (subcommand === 'enable') {
      await handleCardSetup(interaction);
    } else if (subcommand === 'goodbye-image') {
      await handleGoodbyeImageSetup(interaction);
    }
  } else if (subcommandGroup === 'embed') {
    await handleEmbedSetup(interaction);
  } else if (subcommandGroup === 'autorole') {
    await handleAutoroleSetup(interaction);
  } else if (subcommand === 'test') {
    await handleTest(interaction);
  } else if (subcommand === 'view') {
    await handleView(interaction);
  }
}

async function handleWelcomeSetup(interaction: any) {
    if (!interaction.guild) return;

    const enabled = interaction.options.getBoolean('enabled', true);
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    const updates: any = { welcomeEnabled: enabled };
    if (channel) updates.welcomeChannel = channel.id;
    if (message) updates.welcomeMessage = message;

    await welcomeHandler.updateWelcomeSettings(interaction.guild.id, updates);

    const embed = createSuccessEmbed(
      'Welcome Setup',
      `Welcome messages have been ${enabled ? 'enabled' : 'disabled'}.`
    );

    if (enabled) {
      embed.addFields(
        {
          name: 'Channel',
          value: channel ? channel.toString() : 'Not set',
          inline: true,
        },
        {
          name: 'Message',
          value: message || 'Using default message',
          inline: false,
        }
      );
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

async function handleGoodbyeSetup(interaction: any) {
    if (!interaction.guild) return;

    const enabled = interaction.options.getBoolean('enabled', true);
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    const updates: any = { goodbyeEnabled: enabled };
    if (channel) updates.goodbyeChannel = channel.id;
    if (message) updates.goodbyeMessage = message;

    await welcomeHandler.updateWelcomeSettings(interaction.guild.id, updates);

    const embed = createSuccessEmbed(
      'Goodbye Setup',
      `Goodbye messages have been ${enabled ? 'enabled' : 'disabled'}.`
    );

    if (enabled) {
      embed.addFields(
        {
          name: 'Channel',
          value: channel ? channel.toString() : 'Not set',
          inline: true,
        },
        {
          name: 'Message',
          value: message || 'Using default message',
          inline: false,
        }
      );
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

async function handleDMSetup(interaction: any) {
    if (!interaction.guild) return;

    const enabled = interaction.options.getBoolean('enabled', true);
    const message = interaction.options.getString('message');

    const updates: any = { dmWelcome: enabled };
    if (message) updates.dmMessage = message;

    await welcomeHandler.updateWelcomeSettings(interaction.guild.id, updates);

    const embed = createSuccessEmbed(
      'DM Welcome Setup',
      `DM welcome messages have been ${enabled ? 'enabled' : 'disabled'}.`
    );

    if (enabled && message) {
      embed.addFields({
        name: 'Message',
        value: message,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

async function handleCardSetup(interaction: any) {
    if (!interaction.guild) return;

    const enabled = interaction.options.getBoolean('enabled', true);
    const color = interaction.options.getString('color');

    const updates: any = { welcomeCard: enabled };
    if (color) {
      // Validate hex color
      const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexRegex.test(color)) {
        return interaction.reply({
          embeds: [createErrorEmbed('Invalid Color', 'Please provide a valid hex color code (e.g., #7289da)')],
          ephemeral: true,
        });
      }
      updates.welcomeCardColor = color;
    }

    await welcomeHandler.updateWelcomeSettings(interaction.guild.id, updates);

    const embed = createSuccessEmbed(
      'Welcome Cards',
      `Welcome cards have been ${enabled ? 'enabled' : 'disabled'}.`
    );

    if (enabled && color) {
      embed.addFields({
        name: 'Card Color',
        value: color,
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

async function handleGoodbyeImageSetup(interaction: any) {
    if (!interaction.guild) return;

    const enabled = interaction.options.getBoolean('enabled', true);

    await welcomeHandler.updateWelcomeSettings(interaction.guild.id, { goodbyeImage: enabled });

    await interaction.reply({
      embeds: [createSuccessEmbed(
        'Goodbye Images',
        `Goodbye images have been ${enabled ? 'enabled' : 'disabled'}.`
      )],
      ephemeral: true,
    });
  }

async function handleEmbedSetup(interaction: any) {
    if (!interaction.guild) return;

    const enabled = interaction.options.getBoolean('enabled', true);
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color');
    const footer = interaction.options.getString('footer');
    const thumbnail = interaction.options.getBoolean('thumbnail');

    const updates: any = { welcomeEmbed: enabled };
    if (title) updates.embedTitle = title;
    if (description) updates.embedDescription = description;
    if (color) {
      const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexRegex.test(color)) {
        return interaction.reply({
          embeds: [createErrorEmbed('Invalid Color', 'Please provide a valid hex color code (e.g., #7289da)')],
          ephemeral: true,
        });
      }
      updates.embedColor = color;
    }
    if (footer) updates.embedFooter = footer;
    if (thumbnail !== null) updates.embedThumbnail = thumbnail;

    await welcomeHandler.updateWelcomeSettings(interaction.guild.id, updates);

    const embed = createSuccessEmbed(
      'Embed Setup',
      `Welcome embeds have been ${enabled ? 'enabled' : 'disabled'}.`
    );

    if (enabled) {
      const fields = [];
      if (title) fields.push({ name: 'Title', value: title, inline: true });
      if (description) fields.push({ name: 'Description', value: description, inline: false });
      if (color) fields.push({ name: 'Color', value: color, inline: true });
      if (footer) fields.push({ name: 'Footer', value: footer, inline: true });
      if (thumbnail !== null) fields.push({ name: 'Thumbnail', value: thumbnail ? 'Enabled' : 'Disabled', inline: true });
      
      if (fields.length > 0) {
        embed.addFields(fields);
      }
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

async function handleAutoroleSetup(interaction: any) {
    if (!interaction.guild) return;

    const enabled = interaction.options.getBoolean('enabled', true);
    const role1 = interaction.options.getRole('role1');
    const role2 = interaction.options.getRole('role2');
    const role3 = interaction.options.getRole('role3');

    const roles = [role1, role2, role3].filter(role => role).map(role => role!.id);

    const updates: any = { autoroleEnabled: enabled };
    if (roles.length > 0) updates.autoroles = roles;

    await welcomeHandler.updateWelcomeSettings(interaction.guild.id, updates);

    const embed = createSuccessEmbed(
      'Autorole Setup',
      `Autoroles have been ${enabled ? 'enabled' : 'disabled'}.`
    );

    if (enabled && roles.length > 0) {
      embed.addFields({
        name: 'Roles',
        value: [role1, role2, role3].filter(role => role).map(role => role!.toString()).join('\n'),
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

async function handleTest(interaction: any) {
    if (!interaction.guild || !interaction.member) return;

    const type = interaction.options.getString('type', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      if (type === 'welcome') {
        await welcomeHandler.testWelcome(interaction.member as any);
        await interaction.editReply({
          embeds: [createSuccessEmbed('Test Complete', 'Welcome message test sent!')],
        });
      } else if (type === 'goodbye') {
        await welcomeHandler.testGoodbye(interaction.member as any);
        await interaction.editReply({
          embeds: [createSuccessEmbed('Test Complete', 'Goodbye message test sent!')],
        });
      }
    } catch (error) {
      console.error('Error testing welcome/goodbye:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Test Failed', 'Failed to send test message. Check your configuration.')],
      });
    }
  }

async function handleView(interaction: any) {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    // This would require implementing a method to get current settings
    // For now, show a basic configuration view
    const embed = createEmbed({
      title: `${emojis.info} Welcome Configuration`,
      description: `Current welcome/goodbye settings for ${interaction.guild.name}`,
      color: colors.primary,
      fields: [
        {
          name: 'Available Placeholders',
          value: '`{user}` - User mention\n' +
                 '`{user.tag}` - User tag\n' +
                 '`{user.username}` - Username\n' +
                 '`{server}` - Server name\n' +
                 '`{membercount}` - Member count\n' +
                 '`{date}` - Current date\n' +
                 '`{time}` - Current time',
          inline: false,
        }
      ],
      timestamp: true,
    });

    await interaction.editReply({ embeds: [embed] });
  }