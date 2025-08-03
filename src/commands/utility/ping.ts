import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription(t('commands.ping.description'))
  .setDescriptionLocalizations({
    'es-ES': 'Comprueba la latencia del bot',
    'fr': 'Vérifier la latence du bot',
    'de': 'Überprüfe die Latenz des Bots',
    'nl': 'Controleer de latentie van de bot',
  });

export const category = CommandCategory.Utility;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  const sent = await interaction.deferReply({ fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  const apiLatency = Math.round(interaction.client.ws.ping);

  await interaction.editReply(
    t('commands.ping.response', { latency, apiLatency })
  );
}