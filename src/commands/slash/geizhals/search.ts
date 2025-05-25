import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ClientWithCommands } from '../../../types';
import { getGuildSettings } from '../../../utils/guildSettings';
import Geizhals, { LocationCode } from '../../../../geizhals/index';

export async function executeSuche(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    if (!interaction.guildId) {
        await interaction.reply({ content: 'Dieser Befehl ist nur auf Servern verfügbar.', ephemeral: true });
        return;
    }
    const guildSettings = await getGuildSettings(interaction.guildId, client);
    if (!guildSettings?.enableGeizhals) {
        await interaction.reply({ content: 'Die Geizhals-Integration ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }

    const produkt = interaction.options.getString('produkt', true);
    await interaction.deferReply();

    if (!process.env.GEIZHALS_API_KEY) {
        await interaction.editReply('Der Geizhals API Key ist nicht konfiguriert.');
        return;
    }
    const geizhals = new Geizhals({ apiKey: process.env.GEIZHALS_API_KEY, username: process.env.GEIZHALS_USERNAME });

    try {
      const validLocations = ['de', 'at', 'uk', 'us'] as const;
      const location = validLocations.includes(guildSettings.geizhalsLocation as (typeof validLocations)[number])
        ? guildSettings.geizhalsLocation as (typeof validLocations)[number]
        : undefined;
      const results = await geizhals.searchProducts(produkt, { limit: 5, location: location as LocationCode | undefined });

      if (results.error || !results.response || results.response.length === 0) {
        await interaction.editReply(`Keine Produkte für "${produkt}" gefunden oder ein Fehler ist aufgetreten: ${results.error?.error || 'Unbekannter Fehler'}.`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle(`Geizhals Suchergebnisse für "${produkt}"`)
        .setTimestamp();

      results.response.slice(0, 5).forEach(p => {
        const bestOffer = p.offers && p.offers.length > 0 ? p.offers[0].shop : null;
        embed.addFields({
            name: p.name.substring(0, 250),
            value: `Bester Preis: **${bestOffer?.price?.amount || 'N/V'} ${bestOffer?.price?.currency || ''}** bei ${bestOffer?.name || 'Unbekannt'}\n[Link](${p.urls?.overview || '#'})`,
            inline: false
        });
      });
      if (results.response.length > 5) {
          embed.setFooter({text: `Zeige 5 von ${results.response.length} Ergebnissen.`});
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (e: any) {
      console.error(e);
      await interaction.editReply(`Fehler bei der Geizhals-Suche: ${e.message || 'Unbekannter Fehler'}`);
    }
}