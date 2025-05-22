import cron from 'node-cron';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { client } from '../index';
import { DatabaseService } from '../lib/database';
import Geizhals from '../geizhals';

const geizhals = new Geizhals();

// Kategorien für Hardware-Tracking
export const CATEGORIES = {
  GRAPHICS_CARDS: 'vga256',
  PROCESSORS_INTEL: 'cpu1151',
  PROCESSORS_AMD: 'cpuamdam4',
  MOTHERBOARDS: 'mb1151',
  RAM: 'ramddr4',
  SSD_NVME: 'sm_class0',
  POWER_SUPPLIES: 'psu',
  CASES: 'case',
  MONITORS: 'monlcd',
  COOLING: 'cool',
} as const;

export const CATEGORY_NAMES = {
  [CATEGORIES.GRAPHICS_CARDS]: 'Grafikkarten',
  [CATEGORIES.PROCESSORS_INTEL]: 'Intel Prozessoren',
  [CATEGORIES.PROCESSORS_AMD]: 'AMD Prozessoren',
  [CATEGORIES.MOTHERBOARDS]: 'Mainboards',
  [CATEGORIES.RAM]: 'Arbeitsspeicher',
  [CATEGORIES.SSD_NVME]: 'NVMe SSDs',
  [CATEGORIES.POWER_SUPPLIES]: 'Netzteile',
  [CATEGORIES.CASES]: 'Gehäuse',
  [CATEGORIES.MONITORS]: 'Monitore',
  [CATEGORIES.COOLING]: 'Kühlung',
} as const;

export class GeizhalsTracker {
  private isRunning = false;

  constructor() {
    this.initCronJob();
  }

  private initCronJob() {
    // Prüfe alle 30 Minuten auf Preisänderungen
    cron.schedule('*/30 * * * *', async () => {
      if (this.isRunning) return;
      
      console.log('🔍 Starte Geizhals Preisüberprüfung...');
      await this.checkAllTrackers();
    });

    // Täglich um 8:00 Uhr - Tagesdeals
    cron.schedule('0 8 * * *', async () => {
      console.log('🔥 Lade tägliche Deals...');
      await this.sendDailyDeals();
    });
  }

  async checkAllTrackers() {
    this.isRunning = true;
    
    try {
      // Alle aktiven Tracker aus allen Guilds abrufen
      const guilds = await DatabaseService.prisma.guild.findMany({
        where: { enableGeizhals: true },
        include: {
          geizhalsTrackers: {
            where: { notified: false }
          }
        }
      });

      for (const guild of guilds) {
        if (guild.geizhalsTrackers.length === 0) continue;

        for (const tracker of guild.geizhalsTrackers) {
          await this.checkTracker(tracker, guild.geizhalsChannelId);
          
          // Kleine Verzögerung zwischen API-Calls
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

    } catch (error) {
      console.error('Fehler beim Überprüfen der Tracker:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async checkTracker(tracker: any, channelId?: string) {
    try {
      // Produktdaten von Geizhals abrufen
      const response = await geizhals.queryProduct(tracker.productId, 'id', {
        n_offers: 1,
        loc: 'de'
      });

      if (!response.response) {
        console.warn(`Produkt ${tracker.productId} nicht gefunden`);
        return;
      }

      const product = Array.isArray(response.response) ? response.response[0] : response.response;
      const currentPrice = product.prices?.best || 0;

      // Preisänderung prüfen
      if (currentPrice > 0 && currentPrice <= tracker.targetPrice) {
        await this.sendPriceAlert(tracker, product, currentPrice, channelId);
        
        // Tracker als benachrichtigt markieren
        await DatabaseService.updateGeizhalsTracker(tracker.id, {
          notified: true,
          currentPrice,
          lastCheck: new Date()
        });
      } else {
        // Nur den aktuellen Preis und letzte Überprüfung aktualisieren
        await DatabaseService.updateGeizhalsTracker(tracker.id, {
          currentPrice: currentPrice || tracker.currentPrice,
          lastCheck: new Date()
        });
      }

    } catch (error) {
      console.error(`Fehler beim Überprüfen von Tracker ${tracker.id}:`, error);
    }
  }

  private async sendPriceAlert(tracker: any, product: any, currentPrice: number, channelId?: string) {
    if (!channelId) return;

    try {
      const channel = await client.channels.fetch(channelId) as TextChannel;
      if (!channel) return;

      const user = await client.users.fetch(tracker.userId).catch(() => null);
      const oldPrice = tracker.currentPrice;
      const savings = oldPrice - currentPrice;
      const savingsPercent = Math.round((savings / oldPrice) * 100);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎉 Preisalarm!')
        .setDescription(`**${product.name}** hat deinen Zielpreis erreicht!`)
        .setURL(product.urls?.overview || '')
        .addFields(
          { name: '💰 Neuer Preis', value: `€${currentPrice.toFixed(2)}`, inline: true },
          { name: '🎯 Zielpreis', value: `€${tracker.targetPrice.toFixed(2)}`, inline: true },
          { name: '📉 Ersparnis', value: `€${savings.toFixed(2)} (-${savingsPercent}%)`, inline: true },
          { name: '🛒 Kategorie', value: CATEGORY_NAMES[tracker.category as keyof typeof CATEGORY_NAMES] || tracker.category, inline: true },
          { name: '👤 Benutzer', value: user ? user.toString() : 'Unbekannt', inline: true },
          { name: '🏪 Angebote', value: product.offer_count?.toString() || '0', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Produkt-ID: ${tracker.productId}` });

      if (product.images && product.images.length > 0) {
        embed.setThumbnail(product.images[0]);
      }

      await channel.send({ 
        content: user ? `${user} 🔔` : undefined,
        embeds: [embed] 
      });

      console.log(`✅ Preisalarm gesendet für ${product.name}`);

    } catch (error) {
      console.error('Fehler beim Senden des Preisalarms:', error);
    }
  }

  async sendDailyDeals() {
    try {
      const guilds = await DatabaseService.prisma.guild.findMany({
        where: { 
          enableGeizhals: true,
          geizhalsChannelId: { not: null }
        }
      });

      for (const guild of guilds) {
        await this.sendGuildDeals(guild.id, guild.geizhalsChannelId!);
        
        // Verzögerung zwischen Guilds
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error('Fehler beim Senden der täglichen Deals:', error);
    }
  }

  private async sendGuildDeals(guildId: string, channelId: string) {
    try {
      const channel = await client.channels.fetch(channelId) as TextChannel;
      if (!channel) return;

      // Top Deals von Geizhals abrufen
      const response = await geizhals.getTopDeals({ limit: 10 });
      
      if (!response.response?.deals || response.response.deals.length === 0) {
        return;
      }

      const deals = response.response.deals.slice(0, 5); // Top 5 Deals

      const embed = new EmbedBuilder()
        .setColor(0xff6b35)
        .setTitle('🔥 Tägliche Hardware Deals')
        .setDescription('Die besten Deals des Tages bei Geizhals')
        .setTimestamp();

      deals.forEach((deal, index) => {
        const savings = deal.change_in_percent ? Math.abs(deal.change_in_percent) : 0;
        embed.addFields({
          name: `${index + 1}. ${deal.product}`,
          value: `💰 **€${deal.best_price.toFixed(2)}** ${savings > 0 ? `(-${savings.toFixed(1)}%)` : ''}\n🏪 [${deal.hname}](${deal.best_deep_link})\n⭐ ${deal.rating_stars}/5 (${deal.rating_count} Bewertungen)`,
          inline: false
        });
      });

      embed.setFooter({ text: 'Powered by Geizhals.de' });

      await channel.send({ embeds: [embed] });

      console.log(`✅ Tägliche Deals gesendet an Guild ${guildId}`);

    } catch (error) {
      console.error(`Fehler beim Senden der Deals für Guild ${guildId}:`, error);
    }
  }

  // Manuelle Funktionen für Slash Commands
  async searchProducts(query: string, category?: string, limit: number = 5) {
    try {
      const params: any = {
        n_results: limit,
        loc: 'de'
      };

      let response;
      if (category && Object.values(CATEGORIES).includes(category as any)) {
        response = await geizhals.getCategoryList(category, {
          asuch: query,
          pagesize: limit
        });
      } else {
        response = await geizhals.searchProducts(query, { limit });
      }

      return response;

    } catch (error) {
      console.error('Fehler bei der Produktsuche:', error);
      return null;
    }
  }

  async getCategoryDeals(category: string, limit: number = 10) {
    try {
      const response = await geizhals.getCategoryDeals(category, {
        limit,
        minPriceDrop: 10 // Mindestens 10% Preisrückgang
      });

      return response;

    } catch (error) {
      console.error('Fehler beim Abrufen der Kategorie-Deals:', error);
      return null;
    }
  }

  async addTracker(data: {
    guildId: string;
    productId: string;
    targetPrice: number;
    userId: string;
  }) {
    try {
      // Produktdaten abrufen um Name und aktuelle Preise zu bekommen
      const response = await geizhals.queryProduct(data.productId, 'id', {
        n_offers: 1,
        loc: 'de'
      });

      if (!response.response) {
        throw new Error('Produkt nicht gefunden');
      }

      const product = Array.isArray(response.response) ? response.response[0] : response.response;
      const currentPrice = product.prices?.best || 0;

      // Kategorie bestimmen
      const category = this.determineCategory(product.category);

      const tracker = await DatabaseService.addGeizhalsTracker({
        guildId: data.guildId,
        productId: data.productId,
        productName: product.name,
        targetPrice: data.targetPrice,
        currentPrice,
        category,
        userId: data.userId
      });

      return { tracker, product };

    } catch (error) {
      console.error('Fehler beim Hinzufügen des Trackers:', error);
      throw error;
    }
  }

  private determineCategory(productCategories: any[]): string {
    if (!productCategories || productCategories.length === 0) {
      return 'other';
    }

    const categoryPath = productCategories.map(cat => cat.title || cat.name).join(' ').toLowerCase();

    if (categoryPath.includes('grafik') || categoryPath.includes('gpu')) {
      return CATEGORIES.GRAPHICS_CARDS;
    } else if (categoryPath.includes('prozessor') || categoryPath.includes('cpu')) {
      if (categoryPath.includes('intel')) {
        return CATEGORIES.PROCESSORS_INTEL;
      } else if (categoryPath.includes('amd')) {
        return CATEGORIES.PROCESSORS_AMD;
      }
      return CATEGORIES.PROCESSORS_INTEL; // Default
    } else if (categoryPath.includes('mainboard') || categoryPath.includes('motherboard')) {
      return CATEGORIES.MOTHERBOARDS;
    } else if (categoryPath.includes('arbeitsspeicher') || categoryPath.includes('ram')) {
      return CATEGORIES.RAM;
    } else if (categoryPath.includes('ssd') || categoryPath.includes('nvme')) {
      return CATEGORIES.SSD_NVME;
    } else if (categoryPath.includes('netzteil') || categoryPath.includes('psu')) {
      return CATEGORIES.POWER_SUPPLIES;
    } else if (categoryPath.includes('gehäuse') || categoryPath.includes('case')) {
      return CATEGORIES.CASES;
    } else if (categoryPath.includes('monitor') || categoryPath.includes('display')) {
      return CATEGORIES.MONITORS;
    } else if (categoryPath.includes('kühlung') || categoryPath.includes('cooling')) {
      return CATEGORIES.COOLING;
    }

    return 'other';
  }
}

// Singleton Instance
export const geizhalsTracker = new GeizhalsTracker();