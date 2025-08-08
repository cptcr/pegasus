import {
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  EmbedBuilder,
} from 'discord.js';
import { configurationService } from '../../services/configurationService';
import { t } from '../../i18n';
import { logger } from '../../utils/logger';

export async function handleConfigSelectMenu(
  interaction:
    | StringSelectMenuInteraction
    | ChannelSelectMenuInteraction
    | RoleSelectMenuInteraction
) {
  const [prefix, ...parts] = interaction.customId.split('_');

  if (prefix !== 'config') return;

  const menuType = parts.join('_');

  try {
    switch (menuType) {
      case 'xp_channel_type':
        await handleXPChannelType(interaction as StringSelectMenuInteraction);
        break;
      case 'xp_reward_action':
        await handleXPRewardAction(interaction as StringSelectMenuInteraction);
        break;
      case 'eco_shop_action':
        await handleEcoShopAction(interaction as StringSelectMenuInteraction);
        break;
      case 'welcome_channel_select':
        await handleWelcomeChannelSelect(interaction as ChannelSelectMenuInteraction);
        break;
      case 'goodbye_channel_select':
        await handleGoodbyeChannelSelect(interaction as ChannelSelectMenuInteraction);
        break;
      case 'autorole_add_select':
        await handleAutoroleAddSelect(interaction as RoleSelectMenuInteraction);
        break;
      case 'autorole_remove_select':
        await handleAutoroleRemoveSelect(interaction as StringSelectMenuInteraction);
        break;
    }
  } catch (error) {
    logger.error(`Error handling config select menu ${interaction.customId}:`, error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: t('common.error'),
        ephemeral: true,
      });
    }
  }
}

async function handleXPChannelType(interaction: StringSelectMenuInteraction) {
  const type = interaction.values[0];

  const modal = new ModalBuilder()
    .setCustomId(`config_xp_channels_${type}_modal`)
    .setTitle(t(`config.xp.channels.types.${type === 'no_xp' ? 'noXp' : type}`));

  const config = await configurationService.getXPConfig(interaction.guildId!);
  let currentChannels: string[] = [];

  switch (type) {
    case 'ignored':
      currentChannels = config.ignoredChannels;
      break;
    case 'no_xp':
      currentChannels = config.noXpChannels;
      break;
    case 'double_xp':
      currentChannels = config.doubleXpChannels;
      break;
  }

  const channelsInput = new TextInputBuilder()
    .setCustomId('channels')
    .setLabel('Channel IDs (one per line)')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(currentChannels.join('\n'))
    .setRequired(false)
    .setPlaceholder('123456789012345678\n987654321098765432');

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(channelsInput)
  );

  await interaction.showModal(modal);
}

async function handleXPRewardAction(interaction: StringSelectMenuInteraction): Promise<void> {
  const action = interaction.values[0];

  switch (action) {
    case 'add': {
      const modal = new ModalBuilder()
        .setCustomId('config_xp_reward_add_modal')
        .setTitle('Add XP Role Reward');

      const levelInput = new TextInputBuilder()
        .setCustomId('level')
        .setLabel('Level')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('10');

      const roleInput = new TextInputBuilder()
        .setCustomId('role')
        .setLabel('Role ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('123456789012345678');

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(levelInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(roleInput)
      );

      await interaction.showModal(modal);
      break;
    }

    case 'remove': {
      const rewards = await configurationService.getXPRoleRewards(interaction.guildId!);

      if (rewards.length === 0) {
        await interaction.reply({
          content: 'No rewards to remove',
          ephemeral: true,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('config_xp_reward_remove_modal')
        .setTitle('Remove XP Role Reward');

      const levelInput = new TextInputBuilder()
        .setCustomId('level')
        .setLabel('Level to remove')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('10');

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(levelInput)
      );

      await interaction.showModal(modal);
      break;
    }

    case 'clear': {
      await interaction.deferUpdate();

      const rewards = await configurationService.getXPRoleRewards(interaction.guildId!);
      for (const reward of rewards) {
        await configurationService.removeXPRoleReward(interaction.guildId!, reward.level);
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('XP Rewards Cleared')
        .setDescription('All XP role rewards have been removed')
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        components: [],
      });
      break;
    }
  }
}

async function handleEcoShopAction(interaction: StringSelectMenuInteraction): Promise<void> {
  const action = interaction.values[0];

  switch (action) {
    case 'add': {
      const modal = new ModalBuilder()
        .setCustomId('config_eco_shop_add_modal')
        .setTitle('Add Shop Item');

      const nameInput = new TextInputBuilder()
        .setCustomId('name')
        .setLabel('Item Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(255);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Item Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      const priceInput = new TextInputBuilder()
        .setCustomId('price')
        .setLabel('Price')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const typeInput = new TextInputBuilder()
        .setCustomId('type')
        .setLabel('Type (protection/booster/role/custom)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const stockInput = new TextInputBuilder()
        .setCustomId('stock')
        .setLabel('Stock (-1 for unlimited)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue('-1');

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(descriptionInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(priceInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(typeInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(stockInput)
      );

      await interaction.showModal(modal);
      break;
    }

    case 'edit':
    case 'remove': {
      await interaction.deferUpdate();

      const items = await configurationService.getShopItems(interaction.guildId!);
      if (items.length === 0) {
        await interaction.editReply({
          content: 'No items to ' + action,
          components: [],
        });
        return;
      }

      // Show item selection menu
      // This would require another select menu with item options
      // For now, we'll use a modal with item ID
      const modal = new ModalBuilder()
        .setCustomId(`config_eco_shop_${action}_modal`)
        .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)} Shop Item`);

      const itemIdInput = new TextInputBuilder()
        .setCustomId('itemId')
        .setLabel('Item ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter the item ID');

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(itemIdInput)
      );

      await interaction.showModal(modal);
      break;
    }
  }
}

async function handleWelcomeChannelSelect(
  interaction: ChannelSelectMenuInteraction
): Promise<void> {
  const channel = interaction.channels.first();

  if (!channel || !('isTextBased' in channel && channel.isTextBased())) {
    await interaction.reply({
      content: 'Please select a valid text channel',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  await configurationService.updateWelcomeConfig(interaction.guildId!, {
    channel: channel.id,
  });

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('Welcome Channel Updated')
    .setDescription(`Welcome messages will now be sent to ${channel}`)
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    components: [],
  });
}

async function handleGoodbyeChannelSelect(
  interaction: ChannelSelectMenuInteraction
): Promise<void> {
  const channel = interaction.channels.first();

  if (!channel || !('isTextBased' in channel && channel.isTextBased())) {
    await interaction.reply({
      content: 'Please select a valid text channel',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  await configurationService.updateGoodbyeConfig(interaction.guildId!, {
    channel: channel.id,
  });

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('Goodbye Channel Updated')
    .setDescription(`Goodbye messages will now be sent to ${channel}`)
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    components: [],
  });
}

async function handleAutoroleAddSelect(interaction: RoleSelectMenuInteraction) {
  await interaction.deferUpdate();

  const roles = interaction.roles.map(role => role.id);
  const config = await configurationService.getAutoroleConfig(interaction.guildId!);

  // Merge with existing roles (up to 10 total)
  const allRoles = [...new Set([...config.roles, ...roles])].slice(0, 10);

  await configurationService.updateAutoroleConfig(interaction.guildId!, {
    roles: allRoles,
  });

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('Autorole Updated')
    .setDescription(`Added ${roles.length} role(s) to autorole`)
    .addFields({
      name: 'Current Roles',
      value: allRoles.map(id => `<@&${id}>`).join('\n'),
      inline: false,
    })
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    components: [],
  });
}

async function handleAutoroleRemoveSelect(interaction: StringSelectMenuInteraction) {
  await interaction.deferUpdate();

  const roleToRemove = interaction.values[0];
  const config = await configurationService.getAutoroleConfig(interaction.guildId!);

  const newRoles = config.roles.filter(id => id !== roleToRemove);

  await configurationService.updateAutoroleConfig(interaction.guildId!, {
    roles: newRoles,
  });

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('Autorole Updated')
    .setDescription('Removed role from autorole')
    .addFields({
      name: 'Remaining Roles',
      value: newRoles.length > 0 ? newRoles.map(id => `<@&${id}>`).join('\n') : t('common.none'),
      inline: false,
    })
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    components: [],
  });
}
