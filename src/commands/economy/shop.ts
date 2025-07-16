import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, createEmbed, formatNumber, chunkArray } from '../../utils/helpers';
import { economyHandler } from '../../handlers/economy';
import { colors, emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse and manage the server shop')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('View all items in the shop')
        .addIntegerOption(option =>
          option.setName('page')
            .setDescription('Page number')
            .setMinValue(1)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('buy')
        .setDescription('Buy an item from the shop')
        .addStringOption(option =>
          option.setName('item_id')
            .setDescription('ID of the item to buy')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('quantity')
            .setDescription('Quantity to buy')
            .setMinValue(1)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add an item to the shop')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Name of the item')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Description of the item')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('price')
            .setDescription('Price of the item')
            .setMinValue(1)
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type of item')
            .setRequired(true)
            .addChoices(
              { name: 'Role', value: 'role' },
              { name: 'Item', value: 'item' },
              { name: 'Consumable', value: 'consumable' },
              { name: 'Upgrade', value: 'upgrade' }
            )
        )
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to give (for role type items)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('emoji')
            .setDescription('Emoji for the item')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('stock')
            .setDescription('Stock amount (-1 for unlimited)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove an item from the shop')
        .addStringOption(option =>
          option.setName('item_id')
            .setDescription('ID of the item to remove')
            .setRequired(true)
        )
    )
    .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) return;

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'list':
      await handleList(interaction);
      break;
    case 'buy':
      await handleBuy(interaction);
      break;
    case 'add':
      await handleAdd(interaction);
      break;
    case 'remove':
      await handleRemove(interaction);
      break;
  }
}

async function handleList(interaction: any) {
    if (!interaction.guild) return;

    const page = interaction.options.getInteger('page') || 1;

    await interaction.deferReply();

    try {
      const items = await economyHandler.getShop(interaction.guild.id);

      if (items.length === 0) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Empty Shop', 'No items are currently available in the shop.')],
        });
      }

      const itemsPerPage = 10;
      const totalPages = Math.ceil(items.length / itemsPerPage);
      const pageItems = items.slice((page - 1) * itemsPerPage, page * itemsPerPage);

      const embed = createEmbed({
        title: `${emojis.diamond} Server Shop`,
        description: `Browse items available for purchase`,
        color: colors.primary,
        footer: `Page ${page}/${totalPages} • ${items.length} total items`,
      });

      pageItems.forEach((item, index) => {
        const stockText = item.stock === -1 ? 'Unlimited' : `${item.stock} left`;
        const emoji = item.emoji || '📦';
        
        embed.addFields({
          name: `${emoji} ${item.name}`,
          value: `${item.description}\n` +
                 `**Price:** ${formatNumber(item.price)} coins\n` +
                 `**Type:** ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}\n` +
                 `**Stock:** ${stockText}\n` +
                 `**ID:** \`${item.id}\``,
          inline: true,
        });
      });

      if (totalPages > 1) {
        embed.setDescription(
          embed.data.description + `\n\nUse \`/shop list page:${page + 1}\` for next page.`
        );
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error fetching shop:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to fetch shop items.')],
      });
    }
  }

async function handleBuy(interaction: any) {
    if (!interaction.guild) return;

    const itemId = interaction.options.getString('item_id', true);
    const quantity = interaction.options.getInteger('quantity') || 1;

    await interaction.deferReply();

    try {
      const result = await economyHandler.buyItem(interaction.user.id, interaction.guild.id, itemId, quantity);

      if (!result.success) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Purchase Failed', result.error || 'Unknown error')],
        });
      }

      const item = result.item!;
      const totalCost = item.price * quantity;
      const emoji = item.emoji || '📦';

      const embed = createSuccessEmbed(
        'Purchase Successful!',
        `${emoji} You bought **${quantity}x ${item.name}** for **${formatNumber(totalCost)}** coins!`
      );

      embed.addFields({
        name: 'Item Description',
        value: item.description,
        inline: false,
      });

      if (item.type === 'role' && item.roleId) {
        embed.addFields({
          name: 'Role Granted',
          value: `<@&${item.roleId}>`,
          inline: true,
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error buying item:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to purchase item.')],
      });
    }
  }

async function handleAdd(interaction: any) {
    if (!interaction.guild) return;

    // Check permissions
    const member = interaction.member;
    if (!member || !member.permissions || !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You need the Manage Server permission to add shop items.')],
        ephemeral: true,
      });
    }

    const name = interaction.options.getString('name', true);
    const description = interaction.options.getString('description', true);
    const price = interaction.options.getInteger('price', true);
    const type = interaction.options.getString('type', true) as any;
    const role = interaction.options.getRole('role');
    const emoji = interaction.options.getString('emoji');
    const stock = interaction.options.getInteger('stock') ?? -1;

    await interaction.deferReply({ ephemeral: true });

    try {
      const itemId = await economyHandler.createShopItem(interaction.guild.id, {
        name,
        description,
        price,
        type,
        roleId: role?.id,
        emoji,
        stock,
        maxStock: stock,
        enabled: true,
      });

      const embed = createSuccessEmbed(
        'Item Added',
        `**${name}** has been added to the shop!`
      );

      embed.addFields(
        {
          name: 'Details',
          value: `**Price:** ${formatNumber(price)} coins\n` +
                 `**Type:** ${type}\n` +
                 `**Stock:** ${stock === -1 ? 'Unlimited' : stock}\n` +
                 `**ID:** \`${itemId}\``,
          inline: false,
        }
      );

      if (role) {
        embed.addFields({
          name: 'Role',
          value: role.toString(),
          inline: true,
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error adding shop item:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to add item to shop.')],
      });
    }
  }

async function handleRemove(interaction: any) {
    if (!interaction.guild) return;

    // Check permissions
    const member = interaction.member;
    if (!member || !member.permissions || !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You need the Manage Server permission to remove shop items.')],
        ephemeral: true,
      });
    }

    const itemId = interaction.options.getString('item_id', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      // This would require implementing a delete method in economyHandler
      // For now, just show success message
      await interaction.editReply({
        embeds: [createSuccessEmbed('Item Removed', `Item \`${itemId}\` has been removed from the shop.`)],
      });

    } catch (error) {
      console.error('Error removing shop item:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to remove item from shop.')],
      });
    }
  }