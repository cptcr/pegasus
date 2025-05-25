import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';
import { executeSuche } from './suche'; // Assuming suche.ts exports executeSuche
// Import other subcommand executors if they exist
// import { executeVerfolgen } from './verfolgen';
// import { executeDeals } from './deals';


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
    // .addSubcommand(subcommand => ...) for 'verfolgen'
    // .addSubcommand(subcommand => ...) for 'deals'
    ,
  enabled: true,
  category: 'geizhals',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'suche':
        await executeSuche(interaction, client);
        break;
      // case 'verfolgen':
      //   await executeVerfolgen(interaction, client);
      //   break;
      // case 'deals':
      //   await executeDeals(interaction, client);
      //   break;
      default:
        await interaction.reply({ content: 'Unbekannter Geizhals-Unterbefehl.', ephemeral: true });
    }
  }
};

export default command;