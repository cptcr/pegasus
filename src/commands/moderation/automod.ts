import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, createEmbed } from '../../utils/helpers';
import { autoModHandler } from '../../handlers/automod';
import { colors, emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure automatic moderation')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new automod filter')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type of filter')
            .setRequired(true)
            .addChoices(
              { name: 'Profanity', value: 'profanity' },
              { name: 'Spam', value: 'spam' },
              { name: 'Links', value: 'links' },
              { name: 'Discord Invites', value: 'invites' },
              { name: 'Excessive Caps', value: 'caps' },
              { name: 'Mass Mentions', value: 'mentions' },
              { name: 'Zalgo Text', value: 'zalgo' },
              { name: 'Custom Words', value: 'custom' }
            )
        )
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Action to take when filter is triggered')
            .setRequired(true)
            .addChoices(
              { name: 'Delete Only', value: 'delete' },
              { name: 'Warn', value: 'warn' },
              { name: 'Mute', value: 'mute' },
              { name: 'Kick', value: 'kick' },
              { name: 'Ban', value: 'ban' }
            )
        )
        .addIntegerOption(option =>
          option.setName('threshold')
            .setDescription('Threshold for triggering (varies by filter type)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('duration')
            .setDescription('Duration in minutes for mute action')
            .setMinValue(1)
            .setMaxValue(10080)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all automod filters')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable a filter')
        .addStringOption(option =>
          option.setName('filter_id')
            .setDescription('ID of the filter to toggle')
            .setRequired(true)
        )
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Enable or disable the filter')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete an automod filter')
        .addStringOption(option =>
          option.setName('filter_id')
            .setDescription('ID of the filter to delete')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('whitelist')
        .setDescription('Add words to filter whitelist')
        .addStringOption(option =>
          option.setName('filter_id')
            .setDescription('ID of the filter')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('words')
            .setDescription('Comma-separated words to whitelist')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('blacklist')
        .setDescription('Add words to filter blacklist')
        .addStringOption(option =>
          option.setName('filter_id')
            .setDescription('ID of the filter')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('words')
            .setDescription('Comma-separated words to blacklist')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('exempt')
        .setDescription('Add role or channel exemptions')
        .addStringOption(option =>
          option.setName('filter_id')
            .setDescription('ID of the filter')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to exempt from this filter')
            .setRequired(false)
        )
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to exempt from this filter')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('violations')
        .setDescription('View automod violations')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to check violations for')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('clear-violations')
        .setDescription('Clear violation history')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to clear violations for')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type of violations to clear')
            .setRequired(false)
            .addChoices(
              { name: 'All', value: 'all' },
              { name: 'Profanity', value: 'profanity' },
              { name: 'Spam', value: 'spam' },
              { name: 'Links', value: 'links' },
              { name: 'Invites', value: 'invites' },
              { name: 'Caps', value: 'caps' },
              { name: 'Mentions', value: 'mentions' },
              { name: 'Zalgo', value: 'zalgo' },
              { name: 'Custom', value: 'custom' }
            )
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) return;

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create':
      await handleCreate(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
    case 'toggle':
      await handleToggle(interaction);
      break;
    case 'delete':
      await handleDelete(interaction);
      break;
    case 'whitelist':
      await handleWhitelist(interaction);
      break;
    case 'blacklist':
      await handleBlacklist(interaction);
      break;
    case 'exempt':
      await handleExempt(interaction);
      break;
    case 'violations':
      await handleViolations(interaction);
      break;
    case 'clear-violations':
      await handleClearViolations(interaction);
      break;
  }
}

async function handleCreate(interaction: any) {
    if (!interaction.guild) return;

    const type = interaction.options.getString('type', true) as any;
    const action = interaction.options.getString('action', true) as any;
    const threshold = interaction.options.getInteger('threshold');
    const duration = interaction.options.getInteger('duration');

    await interaction.deferReply({ ephemeral: true });

    try {
      const filterId = await autoModHandler.createFilter(
        interaction.guild.id,
        type,
        action,
        {
          threshold,
          duration: duration ? duration * 60000 : undefined, // Convert to milliseconds
        }
      );

      await interaction.editReply({
        embeds: [createSuccessEmbed(
          'AutoMod Filter Created',
          `Filter created successfully!\n\n` +
          `**Type:** ${type}\n` +
          `**Action:** ${action}\n` +
          `**Filter ID:** \`${filterId}\`\n\n` +
          `Use \`/automod whitelist\` or \`/automod blacklist\` to configure word lists.`
        )],
      });

    } catch (error) {
      console.error('Error creating automod filter:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to create automod filter.')],
      });
    }
  }

async function handleList(interaction: any) {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const filters = await autoModHandler.getFilters(interaction.guild.id);

      if (filters.length === 0) {
        return interaction.editReply({
          embeds: [createErrorEmbed('No Filters', 'No automod filters found.')],
        });
      }

      const embed = createEmbed({
        title: `${emojis.shield} AutoMod Filters`,
        description: `Active filters for ${interaction.guild.name}`,
        color: colors.primary,
      });

      filters.forEach((filter, index) => {
        const status = filter.enabled ? '✅ Enabled' : '❌ Disabled';
        embed.addFields({
          name: `${index + 1}. ${filter.type.charAt(0).toUpperCase() + filter.type.slice(1)}`,
          value: `**ID:** \`${filter.id}\`\n` +
                 `**Action:** ${filter.action}\n` +
                 `**Status:** ${status}\n` +
                 `**Threshold:** ${filter.threshold || 'Default'}\n` +
                 `**Whitelist:** ${filter.whitelist.length} words\n` +
                 `**Blacklist:** ${filter.blacklist.length} words`,
          inline: true,
        });
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error fetching automod filters:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to fetch automod filters.')],
      });
    }
  }

async function handleToggle(interaction: any) {
    if (!interaction.guild) return;

    const filterId = interaction.options.getString('filter_id', true);
    const enabled = interaction.options.getBoolean('enabled', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      const success = await autoModHandler.updateFilter(filterId, { enabled });

      if (!success) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Error', 'Filter not found or could not be updated.')],
        });
      }

      await interaction.editReply({
        embeds: [createSuccessEmbed(
          'Filter Updated',
          `Filter \`${filterId}\` has been ${enabled ? 'enabled' : 'disabled'}.`
        )],
      });

    } catch (error) {
      console.error('Error toggling automod filter:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to toggle automod filter.')],
      });
    }
  }

async function handleDelete(interaction: any) {
    if (!interaction.guild) return;

    const filterId = interaction.options.getString('filter_id', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      const success = await autoModHandler.deleteFilter(filterId);

      if (!success) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Error', 'Filter not found.')],
        });
      }

      await interaction.editReply({
        embeds: [createSuccessEmbed('Filter Deleted', `Filter \`${filterId}\` has been deleted.`)],
      });

    } catch (error) {
      console.error('Error deleting automod filter:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to delete automod filter.')],
      });
    }
  }

async function handleWhitelist(interaction: any) {
    if (!interaction.guild) return;

    const filterId = interaction.options.getString('filter_id', true);
    const words = interaction.options.getString('words', true).split(',').map((w: string) => w.trim());

    await interaction.deferReply({ ephemeral: true });

    try {
      const filters = await autoModHandler.getFilters(interaction.guild.id);
      const filter = filters.find(f => f.id === filterId);

      if (!filter) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Error', 'Filter not found.')],
        });
      }

      const newWhitelist = [...filter.whitelist, ...words];
      const success = await autoModHandler.updateFilter(filterId, { whitelist: newWhitelist });

      if (!success) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Error', 'Failed to update whitelist.')],
        });
      }

      await interaction.editReply({
        embeds: [createSuccessEmbed(
          'Whitelist Updated',
          `Added ${words.length} words to whitelist for filter \`${filterId}\`.`
        )],
      });

    } catch (error) {
      console.error('Error updating whitelist:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to update whitelist.')],
      });
    }
  }

async function handleBlacklist(interaction: any) {
    if (!interaction.guild) return;

    const filterId = interaction.options.getString('filter_id', true);
    const words = interaction.options.getString('words', true).split(',').map((w: string) => w.trim());

    await interaction.deferReply({ ephemeral: true });

    try {
      const filters = await autoModHandler.getFilters(interaction.guild.id);
      const filter = filters.find(f => f.id === filterId);

      if (!filter) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Error', 'Filter not found.')],
        });
      }

      const newBlacklist = [...filter.blacklist, ...words];
      const success = await autoModHandler.updateFilter(filterId, { blacklist: newBlacklist });

      if (!success) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Error', 'Failed to update blacklist.')],
        });
      }

      await interaction.editReply({
        embeds: [createSuccessEmbed(
          'Blacklist Updated',
          `Added ${words.length} words to blacklist for filter \`${filterId}\`.`
        )],
      });

    } catch (error) {
      console.error('Error updating blacklist:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to update blacklist.')],
      });
    }
  }

async function handleExempt(interaction: any) {
    if (!interaction.guild) return;

    const filterId = interaction.options.getString('filter_id', true);
    const role = interaction.options.getRole('role');
    const channel = interaction.options.getChannel('channel');

    if (!role && !channel) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'Please provide either a role or channel to exempt.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const filters = await autoModHandler.getFilters(interaction.guild.id);
      const filter = filters.find(f => f.id === filterId);

      if (!filter) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Error', 'Filter not found.')],
        });
      }

      const updates: any = {};

      if (role) {
        updates.exemptRoles = [...filter.exemptRoles, role.id];
      }

      if (channel) {
        updates.exemptChannels = [...filter.exemptChannels, channel.id];
      }

      const success = await autoModHandler.updateFilter(filterId, updates);

      if (!success) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Error', 'Failed to update exemptions.')],
        });
      }

      const exempted = [];
      if (role) exempted.push(`Role: ${role.name}`);
      if (channel) exempted.push(`Channel: ${channel.name}`);

      await interaction.editReply({
        embeds: [createSuccessEmbed(
          'Exemptions Updated',
          `Added exemptions to filter \`${filterId}\`:\n${exempted.join('\n')}`
        )],
      });

    } catch (error) {
      console.error('Error updating exemptions:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to update exemptions.')],
      });
    }
  }

async function handleViolations(interaction: any) {
    if (!interaction.guild) return;

    const user = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    try {
      const violations = await autoModHandler.getViolations(interaction.guild.id, user?.id);

      if (violations.length === 0) {
        return interaction.editReply({
          embeds: [createEmbed({
            title: 'No Violations',
            description: user ? `${user.tag} has no automod violations.` : 'No automod violations found.',
            color: colors.success,
          })],
        });
      }

      const embed = createEmbed({
        title: `${emojis.warning} AutoMod Violations`,
        description: user ? `Violations for ${user.tag}` : 'Recent violations in this server',
        color: colors.warning,
      });

      violations.slice(0, 10).forEach(violation => {
        const violationUser = interaction.client.users.cache.get(violation.user_id);
        embed.addFields({
          name: `${violation.violation_type.charAt(0).toUpperCase() + violation.violation_type.slice(1)}`,
          value: `**User:** ${violationUser?.tag || 'Unknown'}\n` +
                 `**Count:** ${violation.count}\n` +
                 `**Last:** <t:${Math.floor(new Date(violation.last_violation).getTime() / 1000)}:R>`,
          inline: true,
        });
      });

      if (violations.length > 10) {
        embed.setFooter({ text: `Showing 10 of ${violations.length} violations` });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error fetching violations:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to fetch violations.')],
      });
    }
  }

async function handleClearViolations(interaction: any) {
    if (!interaction.guild) return;

    const user = interaction.options.getUser('user');
    const type = interaction.options.getString('type');

    await interaction.deferReply({ ephemeral: true });

    try {
      await autoModHandler.clearViolations(
        interaction.guild.id,
        user?.id,
        type === 'all' ? undefined : type || undefined
      );

      let message = 'All automod violations have been cleared.';
      if (user) message = `Violations for ${user.tag} have been cleared.`;
      if (type && type !== 'all') message += ` (${type} only)`;

      await interaction.editReply({
        embeds: [createSuccessEmbed('Violations Cleared', message)],
      });

    } catch (error) {
      console.error('Error clearing violations:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to clear violations.')],
      });
    }
  }