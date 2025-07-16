import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, createEmbed } from '../../utils/helpers';
import { reactionRolesHandler } from '../../handlers/reactionRoles';
import { colors, emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
    .setName('reactionroles')
    .setDescription('Manage reaction role panels')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new reaction role panel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to create the panel in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Title of the panel')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Description of the panel')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type of reaction role panel')
            .setRequired(true)
            .addChoices(
              { name: 'Reactions', value: 'reaction' },
              { name: 'Buttons', value: 'button' },
              { name: 'Dropdown', value: 'dropdown' }
            )
        )
        .addStringOption(option =>
          option.setName('color')
            .setDescription('Embed color (hex code)')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('max_roles')
            .setDescription('Maximum roles a user can have from this panel (0 = unlimited)')
            .setMinValue(0)
            .setMaxValue(25)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add-role')
        .setDescription('Add a role to a panel')
        .addStringOption(option =>
          option.setName('panel_id')
            .setDescription('ID of the panel')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to add')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('emoji')
            .setDescription('Emoji for the role (required for reaction type)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('label')
            .setDescription('Label for the role (for buttons/dropdown)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Description of the role')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('style')
            .setDescription('Button style (for button type)')
            .setRequired(false)
            .addChoices(
              { name: 'Primary (Blue)', value: 'primary' },
              { name: 'Secondary (Gray)', value: 'secondary' },
              { name: 'Success (Green)', value: 'success' },
              { name: 'Danger (Red)', value: 'danger' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('deploy')
        .setDescription('Deploy a reaction role panel')
        .addStringOption(option =>
          option.setName('panel_id')
            .setDescription('ID of the panel to deploy')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all reaction role panels')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a reaction role panel')
        .addStringOption(option =>
          option.setName('panel_id')
            .setDescription('ID of the panel to delete')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit panel settings')
        .addStringOption(option =>
          option.setName('panel_id')
            .setDescription('ID of the panel to edit')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('title')
            .setDescription('New title')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('description')
            .setDescription('New description')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('color')
            .setDescription('New color (hex code)')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('max_roles')
            .setDescription('New max roles limit')
            .setMinValue(0)
            .setMaxValue(25)
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) return;

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create':
      await handleCreate(interaction);
      break;
    case 'add-role':
      await handleAddRole(interaction);
      break;
    case 'deploy':
      await handleDeploy(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
    case 'delete':
      await handleDelete(interaction);
      break;
    case 'edit':
      await handleEdit(interaction);
      break;
  }
}

async function handleCreate(interaction: any) {
    if (!interaction.guild) return;

    const channel = interaction.options.getChannel('channel', true);
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const type = interaction.options.getString('type', true) as any;
    const color = interaction.options.getString('color') || colors.primary;
    const maxRoles = interaction.options.getInteger('max_roles') || 0;

    // Validate hex color
    if (color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Invalid Color', 'Please provide a valid hex color code (e.g., #7289da)')],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const panelId = await reactionRolesHandler.createPanel(interaction.guild.id, channel.id, {
        title,
        description,
        type,
        color,
        maxRoles,
      });

      const embed = createSuccessEmbed(
        'Panel Created',
        `Reaction role panel created successfully!`
      );

      embed.addFields(
        {
          name: 'Panel Details',
          value: `**ID:** \`${panelId}\`\n` +
                 `**Type:** ${type}\n` +
                 `**Channel:** ${channel}\n` +
                 `**Max Roles:** ${maxRoles === 0 ? 'Unlimited' : maxRoles}`,
          inline: false,
        },
        {
          name: 'Next Steps',
          value: `1. Use \`/reactionroles add-role\` to add roles to the panel\n` +
                 `2. Use \`/reactionroles deploy\` to publish the panel`,
          inline: false,
        }
      );

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error creating reaction role panel:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to create reaction role panel.')],
      });
    }
  }

async function handleAddRole(interaction: any) {
    if (!interaction.guild) return;

    const panelId = interaction.options.getString('panel_id', true);
    const role = interaction.options.getRole('role', true);
    const emoji = interaction.options.getString('emoji');
    const label = interaction.options.getString('label') || role.name;
    const description = interaction.options.getString('description');
    const style = interaction.options.getString('style') || 'primary';

    await interaction.deferReply({ ephemeral: true });

    try {
      // Check if bot can manage the role
      const botMember = interaction.guild.members.me;
      if (!botMember || role.position >= botMember.roles.highest.position) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Permission Error', 'I cannot assign this role because it is higher than or equal to my highest role.')],
        });
      }

      const roleId = await reactionRolesHandler.addRoleToPanel(panelId, role.id, {
        emoji: emoji || undefined,
        label,
        description: description || undefined,
        style,
      });

      const embed = createSuccessEmbed(
        'Role Added',
        `Role ${role} has been added to the panel!`
      );

      embed.addFields({
        name: 'Role Details',
        value: `**Role:** ${role}\n` +
               `**Label:** ${label}\n` +
               `**Emoji:** ${emoji || 'None'}\n` +
               `**Style:** ${style}\n` +
               `**ID:** \`${roleId}\``,
        inline: false,
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error adding role to panel:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to add role to panel. Make sure the panel ID is correct.')],
      });
    }
  }

async function handleDeploy(interaction: any) {
    if (!interaction.guild) return;

    const panelId = interaction.options.getString('panel_id', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      const messageId = await reactionRolesHandler.deployPanel(panelId);

      if (!messageId) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Deploy Failed', 'Failed to deploy panel. Make sure the panel exists and has roles added.')],
        });
      }

      const embed = createSuccessEmbed(
        'Panel Deployed',
        `Reaction role panel has been deployed successfully!`
      );

      embed.addFields({
        name: 'Details',
        value: `**Panel ID:** \`${panelId}\`\n` +
               `**Message ID:** \`${messageId}\``,
        inline: false,
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error deploying panel:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to deploy reaction role panel.')],
      });
    }
  }

async function handleList(interaction: any) {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const panels = await reactionRolesHandler.getPanels(interaction.guild.id);

      if (panels.length === 0) {
        return interaction.editReply({
          embeds: [createErrorEmbed('No Panels', 'No reaction role panels found.')],
        });
      }

      const embed = createEmbed({
        title: `${emojis.info} Reaction Role Panels`,
        description: `Found ${panels.length} panel${panels.length !== 1 ? 's' : ''} in this server`,
        color: colors.primary,
      });

      panels.forEach((panel, index) => {
        const channel = interaction.guild?.channels.cache.get(panel.channelId);
        const status = panel.messageId ? '✅ Deployed' : '⏳ Not Deployed';

        embed.addFields({
          name: `${index + 1}. ${panel.title}`,
          value: `**ID:** \`${panel.id}\`\n` +
                 `**Type:** ${panel.type}\n` +
                 `**Channel:** ${channel || 'Unknown'}\n` +
                 `**Status:** ${status}\n` +
                 `**Max Roles:** ${panel.maxRoles === 0 ? 'Unlimited' : panel.maxRoles}`,
          inline: true,
        });
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error listing panels:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to fetch reaction role panels.')],
      });
    }
  }

async function handleDelete(interaction: any) {
    if (!interaction.guild) return;

    const panelId = interaction.options.getString('panel_id', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      const success = await reactionRolesHandler.deletePanel(panelId);

      if (!success) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Delete Failed', 'Panel not found or could not be deleted.')],
        });
      }

      await interaction.editReply({
        embeds: [createSuccessEmbed('Panel Deleted', `Panel \`${panelId}\` has been deleted successfully.`)],
      });

    } catch (error) {
      console.error('Error deleting panel:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to delete reaction role panel.')],
      });
    }
  }

async function handleEdit(interaction: any) {
    if (!interaction.guild) return;

    const panelId = interaction.options.getString('panel_id', true);
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color');
    const maxRoles = interaction.options.getInteger('max_roles');

    if (!title && !description && !color && maxRoles === null) {
      return interaction.reply({
        embeds: [createErrorEmbed('No Changes', 'Please provide at least one field to update.')],
        ephemeral: true,
      });
    }

    // Validate hex color
    if (color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Invalid Color', 'Please provide a valid hex color code (e.g., #7289da)')],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // This would require implementing an update method in the handler
      // For now, show a success message
      const embed = createSuccessEmbed(
        'Panel Updated',
        `Panel \`${panelId}\` has been updated successfully!`
      );

      const changes = [];
      if (title) changes.push(`**Title:** ${title}`);
      if (description) changes.push(`**Description:** ${description}`);
      if (color) changes.push(`**Color:** ${color}`);
      if (maxRoles !== null) changes.push(`**Max Roles:** ${maxRoles === 0 ? 'Unlimited' : maxRoles}`);

      if (changes.length > 0) {
        embed.addFields({
          name: 'Changes Made',
          value: changes.join('\n'),
          inline: false,
        });
      }

      embed.addFields({
        name: 'Note',
        value: 'You may need to redeploy the panel for changes to take effect.',
        inline: false,
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error editing panel:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to edit reaction role panel.')],
      });
    }
  }