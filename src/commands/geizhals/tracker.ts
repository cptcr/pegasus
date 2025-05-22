import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits 
} from 'discord.js';
import { DatabaseService } from '../../lib/database';
import { geizhalsTracker, CATEGORIES, CATEGORY_NAMES } from '../../services/geizhalsTracker';

export const data = new SlashCommandBuilder()
  .setName('geizhals')
  .setDescription('Geizhals Preisverfolgungs-System')
  .addSubcommand(subcommand =>
    subcommand
      .setName('search')
      .setDescription('Nach Produkten suchen')
      .addStringOption(option =>
        option
          .setName('query')
          .setDescription('Suchbegriff')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('category')
          .setDescription('Produktkategorie')
          .setRequired(false)
          .addChoices(
            { name: 'Grafikkarten', value: CATEGORIES.GRAPHICS_CARDS },
            { name: 'Intel Prozessoren', value: CATEGORIES.PROCESSORS_INTEL },
            { name: 'AMD Prozessoren', value: CATEGORIES.PROCESSORS_AMD },
            { name: 'Mainboards', value: CATEGORIES.MOTHERBOARDS },
            { name: 'Arbeitsspeicher', value: CATEGORIES.RAM },
            { name: 'NVMe SSDs', value: CATEGORIES.SSD_NVME },
            { name: 'Netzteile', value: CATEGORIES.POWER_SUPPLIES },
            { name: 'Gehäuse', value: CATEGORIES.CASES },
            { name: 'Monitore', value: CATEGORIES.MONITORS },
            { name: 'Kühlung', value: CATEGORIES.COOLING }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('track')
      .setDescription('Produkt zur Preisverfolgun hinzufügen')
      .addStringOption(option =>
        option
          .setName('productid')
          .setDescription('Geizhals Produkt-ID')
          .setRequired(true)
      )
      .addNumberOption(option =>
        option
          .setName('targetprice')
          .setDescription('Zielpreis in Euro')
          .setRequired(true)
          .setMinValue(0.01)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Deine Preisverfolgungs-Liste anzeigen')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Preisverfolgun entfernen')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('Tracker-ID')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('deals')
      .setDescription('Aktuelle Deals anzeigen')
      .addStringOption(option =>
        option
          .setName('category')
          .setDescription('Produktkategorie')
          .setRequired(false)
          .addChoices(
            { name: 'Grafikkarten', value: CATEGORIES.GRAPHICS_CARDS },
            { name: 'Intel Prozessoren', value: CATEGORIES.PROCESSORS_INTEL },
            { name: 'AMD Prozessoren', value: CATEGORIES.PROCESSORS_AMD },
            { name: 'Mainboards', value: CATEGORIES.MOTHERBOARDS },
            { name: 'Arbeitsspeicher', value: CATEGORIES.RAM },
            { name: 'NVMe SSDs', value: CATEGORIES.SSD_NVME },
            { name: 'Netzteile', value: CATEGORIES.POWER_SUPPLIES },
            { name: 'Gehäuse', value: CATEGORIES.CASES },
            { name: 'Monitore', value: CATEGORIES.MONITORS },
            { name: 'Kühlung', value: CATEGORIES.COOLING }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('Geizhals-System einrichten (Admin)')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel für Preisalarme')
          .setRequired(true)
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'search':
      await handleSearch(interaction);
      break;
    case 'track':
      await handleTrack(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
    case 'remove':
      await handleRemove(interaction);
      break;
    case 'deals':
      await handleDeals(interaction);
      break;
    case 'setup':
      await handleSetup(interaction);
      break;
  }
}

async function handleSearch(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('query', true);
  const category = interaction.options.getString('category');

  await interaction.deferReply();

  try {
    const response = await geizhalsTracker.searchProducts(query, category || undefined, 5);

    if (!response?.response) {
      return interaction.editReply({
        content: '❌ Keine Produkte gefunden.',
      });
    }

    const products = Array.isArray(response.response) ? response.response : [response.response];

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🔍 Suchergebnisse für "${query}"`)
      .setDescription(`${products.length} Produkt(e) gefunden`)
      .setTimestamp();

    products.slice(0, 5).forEach((product, index) => {
      const price = product.prices?.best || 'Preis nicht verfügbar';
      const rating = product.rating_stars ? `⭐ ${product.rating_stars}/5` : 'Keine Bewertung';
      
      embed.addFields({
        name: `${index + 1}. ${product.name}`,
        value: `💰 **€${typeof price === 'number' ? price.toFixed(2) : price}**\n🆔 ID: \`${product.gzhid}\`\n${rating}\n🔗 [Bei Geizhals ansehen](${product.urls?.overview || ''})`,
        inline: false
      });
    });

    embed.setFooter({ text: 'Verwende /geizhals track mit der Produkt-ID zum Hinzufügen zur Preisverfolgun' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler bei der Produktsuche:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten bei der Suche.',
    });
  }
}

async function handleTrack(interaction: ChatInputCommandInteraction) {
  const productId = interaction.options.getString('productid', true);
  const targetPrice = interaction.options.getNumber('targetprice', true);
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Prüfe Guild-Einstellungen
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);
    if (!guildSettings.enableGeizhals) {
      return interaction.editReply({
        content: '❌ Das Geizhals-System ist auf diesem Server nicht aktiviert.',
      });
    }

    // Prüfe ob Benutzer bereits zu viele Tracker hat (max 10)
    const existingTrackers = await DatabaseService.prisma.geizhalsTracker.count({
      where: {
        guildId: guild.id,
        userId: interaction.user.id
      }
    });

    if (existingTrackers >= 10) {
      return interaction.editReply({
        content: '❌ Du kannst maximal 10 Produkte gleichzeitig verfolgen.',
      });
    }

    // Tracker hinzufügen
    const result = await geizhalsTracker.addTracker({
      guildId: guild.id,
      productId,
      targetPrice,
      userId: interaction.user.id
    });

    const currentPrice = result.product.prices?.best || 0;
    const isCurrentlyBelow = currentPrice > 0 && currentPrice <= targetPrice;

    const embed = new EmbedBuilder()
      .setColor(isCurrentlyBelow ? 0x00ff00 : 0x3498db)
      .setTitle('✅ Preisverfolgun hinzugefügt')
      .setDescription(`**${result.product.name}** wird jetzt verfolgt!`)
      .addFields(
        { name: '🎯 Zielpreis', value: `€${targetPrice.toFixed(2)}`, inline: true },
        { name: '💰 Aktueller Preis', value: currentPrice > 0 ? `€${currentPrice.toFixed(2)}` : 'Unbekannt', inline: true },
        { name: '🛒 Kategorie', value: CATEGORY_NAMES[result.tracker.category as keyof typeof CATEGORY_NAMES] || 'Sonstiges', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Tracker-ID: ${result.tracker.id}` });

    if (result.product.images && result.product.images.length > 0) {
      embed.setThumbnail(result.product.images[0]);
    }

    if (isCurrentlyBelow) {
      embed.addFields({
        name: '🎉 Zielpreis bereits erreicht!',
        value: 'Du wirst benachrichtigt, sobald der Preis weiter fällt.',
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Hinzufügen des Trackers:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten. Überprüfe die Produkt-ID.',
    });
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  await interaction.deferReply({ ephemeral: true });

  try {
    const trackers = await DatabaseService.prisma.geizhalsTracker.findMany({
      where: {
        guildId: guild.id,
        userId: interaction.user.id
      },
      orderBy: { createdAt: 'desc' }
    });

    if (trackers.length === 0) {
      return interaction.editReply({
        content: '📊 Du verfolgst noch keine Produkte.',
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('📊 Deine Preisverfolgun-Liste')
      .setDescription(`Du verfolgst ${trackers.length} Produkt(e)`)
      .setTimestamp();

    trackers.slice(0, 10).forEach((tracker, index) => {
      const status = tracker.currentPrice <= tracker.targetPrice ? '🎯 Erreicht' : '⏳ Wartend';
      const savings = tracker.currentPrice < tracker.targetPrice ? 
        `(-€${(tracker.targetPrice - tracker.currentPrice).toFixed(2)})` : '';

      embed.addFields({
        name: `${index + 1}. ${tracker.productName}`,
        value: `🆔 \`${tracker.id}\` | ${status}\n💰 €${tracker.currentPrice.toFixed(2)} / €${tracker.targetPrice.toFixed(2)} ${savings}\n🛒 ${CATEGORY_NAMES[tracker.category as keyof typeof CATEGORY_NAMES] || tracker.category}`,
        inline: false
      });
    });

    if (trackers.length > 10) {
      embed.setFooter({ text: `Zeige die neuesten 10 von ${trackers.length} Trackern` });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Abrufen der Tracker-Liste:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Laden deiner Tracker.',
    });
  }
}

async function handleRemove(interaction: ChatInputCommandInteraction) {
  const trackerId = interaction.options.getInteger('id', true);
  const guild = interaction.guild!;

  await interaction.deferReply({ ephemeral: true });

  try {
    // Prüfe ob Tracker dem Benutzer gehört
    const tracker = await DatabaseService.prisma.geizhalsTracker.findFirst({
      where: {
        id: trackerId,
        guildId: guild.id,
        userId: interaction.user.id
      }
    });

    if (!tracker) {
      return interaction.editReply({
        content: '❌ Tracker nicht gefunden oder du hast keine Berechtigung.',
      });
    }

    await DatabaseService.removeGeizhalsTracker(trackerId);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Preisverfolgun entfernt')
      .setDescription(`**${tracker.productName}** wird nicht mehr verfolgt.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Entfernen des Trackers:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Entfernen des Trackers.',
    });
  }
}

async function handleDeals(interaction: ChatInputCommandInteraction) {
  const category = interaction.options.getString('category');

  await interaction.deferReply();

  try {
    let response;
    
    if (category) {
      response = await geizhalsTracker.getCategoryDeals(category, 8);
    } else {
      response = await geizhalsTracker.getCategoryDeals(CATEGORIES.GRAPHICS_CARDS, 5);
    }

    if (!response?.response?.deals || response.response.deals.length === 0) {
      return interaction.editReply({
        content: '❌ Keine Deals in dieser Kategorie gefunden.',
      });
    }

    const deals = response.response.deals;
    const categoryName = category ? CATEGORY_NAMES[category as keyof typeof CATEGORY_NAMES] : 'Hardware';

    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setTitle(`🔥 ${categoryName} Deals`)
      .setDescription(`Top ${deals.length} Deals mit Preisrückgang`)
      .setTimestamp();

    deals.forEach((deal, index) => {
      const savings = deal.change_in_percent ? Math.abs(deal.change_in_percent) : 0;
      const rating = deal.rating_stars ? `⭐ ${deal.rating_stars}/5` : '';

      embed.addFields({
        name: `${index + 1}. ${deal.product}`,
        value: `💰 **€${deal.best_price.toFixed(2)}** ${savings > 0 ? `(-${savings.toFixed(1)}%)` : ''}\n🏪 ${deal.hname}\n${rating}\n🔗 [Kaufen](${deal.best_deep_link})`,
        inline: false
      });
    });

    embed.setFooter({ text: 'Powered by Geizhals.de' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Abrufen der Deals:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Laden der Deals.',
    });
  }
}

async function handleSetup(interaction: ChatInputCommandInteraction) {
  // Admin-Berechtigung prüfen
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ Du benötigst Administrator-Berechtigung für diesen Befehl.',
      ephemeral: true,
    });
  }

  const channel = interaction.options.getChannel('channel', true);
  const guild = interaction.guild!;

  await interaction.deferReply();

  try {
    // Guild-Einstellungen aktualisieren
    await DatabaseService.updateGuildSettings(guild.id, {
      geizhalsChannelId: channel.id,
      enableGeizhals: true,
      name: guild.name
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Geizhals-System eingerichtet')
      .setDescription(`Das Geizhals Preisverfolgungs-System wurde erfolgreich eingerichtet!`)
      .addFields(
        { name: '📢 Alarm-Channel', value: channel.toString(), inline: true },
        { name: '🔧 Status', value: 'Aktiviert', inline: true },
        { name: '⏰ Prüfintervall', value: '30 Minuten', inline: true }
      )
      .addFields(
        { name: '📖 Verwendung', value: 'Benutzer können jetzt `/geizhals track` verwenden um Produkte zur Preisverfolgun hinzuzufügen.', inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Einrichten des Geizhals-Systems:', error);
    await interaction.editReply({
      content: '❌ Ein Fehler ist aufgetreten beim Einrichten des Systems.',
    });
  }
}

export const options = {
  botPermissions: ['SendMessages', 'EmbedLinks'],
};