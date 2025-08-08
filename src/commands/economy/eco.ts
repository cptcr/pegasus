import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { CommandCategory } from '../../types/command';

// Import all economy command handlers
import { execute as balanceExecute } from './balance';
import { execute as dailyExecute } from './daily';
import { execute as workExecute } from './work';
import { execute as robExecute } from './rob';
import { execute as gambleExecute } from './gamble';
import { execute as shopExecute, autocomplete as shopAutocomplete } from './shop';

export const data = new SlashCommandBuilder()
  .setName('eco')
  .setDescription('Economy system commands')
  .setDescriptionLocalizations({
    'es-ES': 'Comandos del sistema económico',
    fr: 'Commandes du système économique',
    de: 'Wirtschaftssystem-Befehle',
  })
  .addSubcommand(subcommand =>
    subcommand
      .setName('balance')
      .setDescription("Check your or another user's balance")
      .setDescriptionLocalizations({
        'es-ES': 'Consulta tu saldo o el de otro usuario',
        fr: "Vérifiez votre solde ou celui d'un autre utilisateur",
        de: 'Überprüfe dein Guthaben oder das eines anderen Benutzers',
      })
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user to check balance for')
          .setDescriptionLocalizations({
            'es-ES': 'El usuario para verificar el saldo',
            fr: "L'utilisateur dont vérifier le solde",
            de: 'Der Benutzer, dessen Guthaben überprüft werden soll',
          })
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('daily')
      .setDescription('Claim your daily reward')
      .setDescriptionLocalizations({
        'es-ES': 'Reclama tu recompensa diaria',
        fr: 'Réclamez votre récompense quotidienne',
        de: 'Fordere deine tägliche Belohnung an',
      })
  )
  .addSubcommand(subcommand =>
    subcommand.setName('work').setDescription('Work to earn money').setDescriptionLocalizations({
      'es-ES': 'Trabaja para ganar dinero',
      fr: "Travaillez pour gagner de l'argent",
      de: 'Arbeite um Geld zu verdienen',
    })
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('rob')
      .setDescription('Attempt to rob another user')
      .setDescriptionLocalizations({
        'es-ES': 'Intenta robar a otro usuario',
        fr: 'Tentez de voler un autre utilisateur',
        de: 'Versuche einen anderen Benutzer auszurauben',
      })
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user to rob')
          .setDescriptionLocalizations({
            'es-ES': 'El usuario a robar',
            fr: "L'utilisateur à voler",
            de: 'Der Benutzer zum Ausrauben',
          })
          .setRequired(true)
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('gamble')
      .setDescription('Gambling games')
      .setDescriptionLocalizations({
        'es-ES': 'Juegos de azar',
        fr: 'Jeux de hasard',
        de: 'Glücksspiele',
      })
      .addSubcommand(subcommand =>
        subcommand
          .setName('dice')
          .setDescription('Roll dice against the dealer')
          .setDescriptionLocalizations({
            'es-ES': 'Tira los dados contra el crupier',
            fr: 'Lancez les dés contre le croupier',
            de: 'Würfle gegen den Dealer',
          })
          .addIntegerOption(option =>
            option
              .setName('bet')
              .setDescription('Amount to bet')
              .setDescriptionLocalizations({
                'es-ES': 'Cantidad a apostar',
                fr: 'Montant à parier',
                de: 'Einsatzbetrag',
              })
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('coinflip')
          .setDescription('Flip a coin')
          .setDescriptionLocalizations({
            'es-ES': 'Lanza una moneda',
            fr: 'Lancez une pièce',
            de: 'Wirf eine Münze',
          })
          .addIntegerOption(option =>
            option.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)
          )
          .addStringOption(option =>
            option
              .setName('choice')
              .setDescription('Heads or tails')
              .setDescriptionLocalizations({
                'es-ES': 'Cara o cruz',
                fr: 'Pile ou face',
                de: 'Kopf oder Zahl',
              })
              .setRequired(true)
              .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('slots')
          .setDescription('Play the slot machine')
          .setDescriptionLocalizations({
            'es-ES': 'Juega a la máquina tragamonedas',
            fr: 'Jouez à la machine à sous',
            de: 'Spiele am Spielautomaten',
          })
          .addIntegerOption(option =>
            option.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('blackjack')
          .setDescription('Play blackjack against the dealer')
          .setDescriptionLocalizations({
            'es-ES': 'Juega al blackjack contra el crupier',
            fr: 'Jouez au blackjack contre le croupier',
            de: 'Spiele Blackjack gegen den Dealer',
          })
          .addIntegerOption(option =>
            option.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('roulette')
          .setDescription('Play roulette')
          .setDescriptionLocalizations({
            'es-ES': 'Juega a la ruleta',
            fr: 'Jouez à la roulette',
            de: 'Spiele Roulette',
          })
          .addIntegerOption(option =>
            option.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)
          )
          .addStringOption(option =>
            option
              .setName('type')
              .setDescription('Type of bet')
              .setDescriptionLocalizations({
                'es-ES': 'Tipo de apuesta',
                fr: 'Type de pari',
                de: 'Art der Wette',
              })
              .setRequired(true)
              .addChoices(
                { name: 'Red', value: 'color:red' },
                { name: 'Black', value: 'color:black' },
                { name: 'Even', value: 'even' },
                { name: 'Odd', value: 'odd' },
                { name: 'Low (1-18)', value: 'low' },
                { name: 'High (19-36)', value: 'high' },
                { name: 'Specific Number', value: 'number' },
                { name: '1st Dozen', value: 'dozen:1' },
                { name: '2nd Dozen', value: 'dozen:2' },
                { name: '3rd Dozen', value: 'dozen:3' }
              )
          )
          .addIntegerOption(option =>
            option
              .setName('number')
              .setDescription('Specific number to bet on (0-36)')
              .setDescriptionLocalizations({
                'es-ES': 'Número específico para apostar (0-36)',
                fr: 'Numéro spécifique sur lequel parier (0-36)',
                de: 'Spezifische Zahl zum Setzen (0-36)',
              })
              .setMinValue(0)
              .setMaxValue(36)
          )
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('shop')
      .setDescription('Shop commands')
      .setDescriptionLocalizations({
        'es-ES': 'Comandos de la tienda',
        fr: 'Commandes de la boutique',
        de: 'Shop-Befehle',
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
      )
  );

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  const group = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  if (group === 'gamble') {
    // Handle gambling subcommands
    await gambleExecute(interaction);
  } else if (group === 'shop') {
    // Handle shop subcommands
    await shopExecute(interaction);
  } else {
    // Handle direct subcommands
    switch (subcommand) {
      case 'balance':
        await balanceExecute(interaction);
        break;
      case 'daily':
        await dailyExecute(interaction);
        break;
      case 'work':
        await workExecute(interaction);
        break;
      case 'rob':
        await robExecute(interaction);
        break;
    }
  }
}

export async function autocomplete(interaction: ChatInputCommandInteraction) {
  const group = interaction.options.getSubcommandGroup();

  if (group === 'shop') {
    await shopAutocomplete(interaction);
  }
}
