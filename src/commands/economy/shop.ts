import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ButtonInteraction,
  MessageFlags,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { economyService } from '../../services/economyService';
import { economyRepository } from '../../repositories/economyRepository';
import { embedBuilder } from '../../handlers/embedBuilder';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('View and purchase items from the shop')
  .setDescriptionLocalizations({
    'es-ES': 'Ver y comprar artículos de la tienda',
    fr: 'Voir et acheter des articles dans la boutique',
    de: 'Artikel im Shop anzeigen und kaufen',
  })
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View available shop items')
      .setDescriptionLocalizations({
        'es-ES': 'Ver artículos disponibles en la tienda',
        fr: 'Voir les articles disponibles dans la boutique',
        de: 'Verfügbare Shop-Artikel anzeigen',
      })
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('buy')
      .setDescription('Purchase an item from the shop')
      .setDescriptionLocalizations({
        'es-ES': 'Comprar un artículo de la tienda',
        fr: 'Acheter un article dans la boutique',
        de: 'Einen Artikel aus dem Shop kaufen',
      })
      .addStringOption(option =>
        option
          .setName('item')
          .setDescription('The item to purchase')
          .setDescriptionLocalizations({
            'es-ES': 'El artículo a comprar',
            fr: "L'article à acheter",
            de: 'Der zu kaufende Artikel',
          })
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption(option =>
        option
          .setName('quantity')
          .setDescription('Quantity to purchase')
          .setDescriptionLocalizations({
            'es-ES': 'Cantidad a comprar',
            fr: 'Quantité à acheter',
            de: 'Zu kaufende Menge',
          })
          .setMinValue(1)
          .setMaxValue(99)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('inventory')
      .setDescription('View your purchased items')
      .setDescriptionLocalizations({
        'es-ES': 'Ver tus artículos comprados',
        fr: 'Voir vos articles achetés',
        de: 'Ihre gekauften Artikel anzeigen',
      })
  );

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'view':
      await handleViewShop(interaction);
      break;
    case 'buy':
      await handleBuyItem(interaction);
      break;
    case 'inventory':
      await handleViewInventory(interaction);
      break;
  }
}

async function handleViewShop(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  try {
    const items = await economyRepository.getShopItems(guildId, true);
    const settings = await economyRepository.ensureSettings(guildId);
    const balance = await economyService.getOrCreateBalance(userId, guildId);

    if (items.length === 0) {
      // Create default shop items if none exist
      await createDefaultShopItems(guildId);
      const newItems = await economyRepository.getShopItems(guildId, true);

      if (newItems.length === 0) {
        await interaction.editReply({
          embeds: [
            embedBuilder.createErrorEmbed(
              'The shop is currently empty. Please contact an administrator.'
            ),
          ],
        });
        return;
      }

      items.push(...newItems);
    }

    const itemsPerPage = 5;
    let currentPage = 0;
    const totalPages = Math.ceil(items.length / itemsPerPage);

    const createShopEmbed = (page: number) => {
      const start = page * itemsPerPage;
      const pageItems = items.slice(start, start + itemsPerPage);

      const embed = new EmbedBuilder()
        .setTitle(`${settings.currencySymbol} Shop`)
        .setDescription(
          `Your balance: ${settings.currencySymbol}${balance.balance.toLocaleString()}`
        )
        .setColor(0x3498db)
        .setFooter({ text: `Page ${page + 1}/${totalPages} • Use /shop buy <item> to purchase` })
        .setTimestamp();

      pageItems.forEach((item, index) => {
        const stockText = item.stock === -1 ? 'Unlimited' : `${item.stock} left`;
        const affordableEmoji = balance.balance >= item.price ? '✅' : '❌';

        embed.addFields({
          name: `${affordableEmoji} ${start + index + 1}. ${item.name}`,
          value:
            `${item.description}\n` +
            `**Price:** ${settings.currencySymbol}${item.price.toLocaleString()} | **Stock:** ${stockText}` +
            (item.effectType
              ? `\n**Effect:** ${formatEffect(item.effectType, item.effectValue)}`
              : ''),
          inline: false,
        });
      });

      return embed;
    };

    const createButtons = (page: number) => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('shop_first')
          .setLabel('⏮️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('shop_prev')
          .setLabel('◀️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('shop_refresh')
          .setLabel('🔄')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('shop_next')
          .setLabel('▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1),
        new ButtonBuilder()
          .setCustomId('shop_last')
          .setLabel('⏭️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1)
      );
    };

    const message = await interaction.editReply({
      embeds: [createShopEmbed(currentPage)],
      components: totalPages > 1 ? [createButtons(currentPage)] : [],
    });

    if (totalPages > 1) {
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000, // 5 minutes
      });

      collector.on('collect', async (i: ButtonInteraction) => {
        if (i.user.id !== userId) {
          await i.reply({ content: 'This shop view is not for you!', ephemeral: true });
          return;
        }

        switch (i.customId) {
          case 'shop_first':
            currentPage = 0;
            break;
          case 'shop_prev':
            currentPage = Math.max(0, currentPage - 1);
            break;
          case 'shop_next':
            currentPage = Math.min(totalPages - 1, currentPage + 1);
            break;
          case 'shop_last':
            currentPage = totalPages - 1;
            break;
          case 'shop_refresh':
            // Refresh balance
            const newBalance = await economyService.getOrCreateBalance(userId, guildId);
            balance.balance = newBalance.balance;
            break;
        }

        await i.update({
          embeds: [createShopEmbed(currentPage)],
          components: [createButtons(currentPage)],
        });
      });

      collector.on('end', async () => {
        await interaction.editReply({ components: [] }).catch(() => {});
      });
    }
  } catch (error) {
    logger.error('Error viewing shop:', error);
    await interaction.editReply({
      embeds: [embedBuilder.createErrorEmbed('Failed to load shop. Please try again later.')],
    });
  }
}

async function handleBuyItem(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const itemName = interaction.options.getString('item', true);
  const quantity = interaction.options.getInteger('quantity') || 1;
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    const items = await economyRepository.getShopItems(guildId, true);
    const item = items.find(i => i.name.toLowerCase() === itemName.toLowerCase());

    if (!item) {
      await interaction.editReply({
        embeds: [embedBuilder.createErrorEmbed('Item not found in the shop!')],
      });
      return;
    }

    const result = await economyService.purchaseItem(userId, guildId, item.id, quantity);
    const settings = await economyRepository.ensureSettings(guildId);

    if (!result.success) {
      await interaction.editReply({
        embeds: [embedBuilder.createErrorEmbed(result.error!)],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Purchase Successful!')
      .setDescription(`You purchased **${quantity}x ${item.name}**!`)
      .setColor(0x2ecc71)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: 'Total Cost',
          value: `${settings.currencySymbol}${(item.price * quantity).toLocaleString()}`,
          inline: true,
        },
        {
          name: 'New Balance',
          value: `${settings.currencySymbol}${result.balance!.balance.toLocaleString()}`,
          inline: true,
        }
      )
      .setTimestamp();

    if (item.effectType) {
      embed.addFields({
        name: 'Effect',
        value: formatEffect(item.effectType, item.effectValue),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error buying item:', error);
    await interaction.editReply({
      embeds: [embedBuilder.createErrorEmbed('Failed to purchase item. Please try again later.')],
    });
  }
}

async function handleViewInventory(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    const userItems = await economyRepository.getUserItems(userId, guildId, true);

    if (userItems.length === 0) {
      await interaction.editReply({
        embeds: [
          embedBuilder.createInfoEmbed(
            'Your inventory is empty! Visit the shop to purchase items.'
          ),
        ],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📦 Your Inventory')
      .setDescription(`You have ${userItems.length} unique item${userItems.length > 1 ? 's' : ''}`)
      .setColor(0x3498db)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    userItems.forEach(userItem => {
      const expiryText = userItem.expiresAt
        ? `\nExpires: <t:${Math.floor(userItem.expiresAt.getTime() / 1000)}:R>`
        : '';

      embed.addFields({
        name: `${userItem.item.name} (x${userItem.quantity})`,
        value:
          `${userItem.item.description}` +
          (userItem.item.effectType
            ? `\n**Effect:** ${formatEffect(userItem.item.effectType, userItem.item.effectValue)}`
            : '') +
          expiryText,
        inline: false,
      });
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error viewing inventory:', error);
    await interaction.editReply({
      embeds: [embedBuilder.createErrorEmbed('Failed to load inventory. Please try again later.')],
    });
  }
}

export async function autocomplete(interaction: any) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const guildId = interaction.guildId!;

  try {
    const items = await economyRepository.getShopItems(guildId, true);
    const filtered = items
      .filter(item => item.name.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    await interaction.respond(
      filtered.map(item => ({
        name: item.name,
        value: item.name,
      }))
    );
  } catch (error) {
    logger.error('Error in shop autocomplete:', error);
    await interaction.respond([]);
  }
}

function formatEffect(effectType: string, effectValue: any): string {
  switch (effectType) {
    case 'rob_protection':
      const duration = effectValue?.duration || 86400;
      return `🛡️ Protection from robbery for ${duration / 3600} hours`;
    case 'xp_boost':
      const multiplier = effectValue?.multiplier || 2;
      const xpDuration = effectValue?.duration || 3600;
      return `📈 ${multiplier}x XP boost for ${xpDuration / 3600} hours`;
    case 'role':
      return `🎭 Grants a special role`;
    default:
      return '✨ Special effect';
  }
}

async function createDefaultShopItems(guildId: string) {
  const defaultItems = [
    {
      guildId,
      name: 'Rob Protection',
      description: 'Protects you from being robbed for 24 hours',
      price: 1000,
      type: 'protection',
      effectType: 'rob_protection',
      effectValue: { duration: 86400 }, // 24 hours
      stock: -1,
    },
    {
      guildId,
      name: 'XP Booster',
      description: 'Doubles your XP gain for 1 hour',
      price: 500,
      type: 'booster',
      effectType: 'xp_boost',
      effectValue: { multiplier: 2, duration: 3600 }, // 1 hour
      stock: -1,
    },
    {
      guildId,
      name: 'Lucky Charm',
      description: 'Increases gambling win rate by 10% for 2 hours',
      price: 2000,
      type: 'booster',
      effectType: 'luck_boost',
      effectValue: { bonus: 10, duration: 7200 }, // 2 hours
      stock: -1,
    },
    {
      guildId,
      name: 'Work Efficiency',
      description: 'Increases work rewards by 50% for 3 hours',
      price: 750,
      type: 'booster',
      effectType: 'work_boost',
      effectValue: { multiplier: 1.5, duration: 10800 }, // 3 hours
      stock: -1,
    },
    {
      guildId,
      name: 'Vault Access',
      description: 'Allows you to store money in the bank (one-time use)',
      price: 5000,
      type: 'utility',
      effectType: 'bank_access',
      effectValue: { uses: 1 },
      stock: -1,
    },
  ];

  for (const item of defaultItems) {
    try {
      await economyRepository.createShopItem(item as any);
    } catch (error) {
      logger.error(`Error creating default shop item ${item.name}:`, error);
    }
  }
}
