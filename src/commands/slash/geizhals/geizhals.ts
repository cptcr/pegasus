import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';
import { executeSuche } from './search';


const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('geizhals')
    .setDescription('Interagiert mit der Geizhals Preisvergleichs-API.')
    .addSubcommand(subcommand =>
        subcommand
            .setName('suche')
            .setDescription('Sucht nach Produkten auf Geizhals.')
            .addStringOption(option => option.setName('produkt').setDescription('Das zu suchende Produkt.').setRequired(true))
    )
    ,
  enabled: true,
  category: 'geizhals',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'suche':
        await executeSuche(interaction, client);
        break;
      default:
        await interaction.reply({ content: 'Unbekannter Geizhals-Unterbefehl.', ephemeral: true });
    }
  }
};

export default command;