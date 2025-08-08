import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { economyGamblingService } from '../../services/economyGamblingService';
import { economyRepository } from '../../repositories/economyRepository';
import { embedBuilder } from '../../handlers/embedBuilder';
import { Validator, CommandSchemas } from '../../security/validator';
import { RateLimitError } from '../../security/errors';
import { auditLogger } from '../../security/audit';
import type {
  DiceResult,
  CoinflipResult,
  SlotsResult,
  BlackjackResult,
  RouletteResult,
} from '../../services/economyGamblingService';

export const data = new SlashCommandBuilder()
  .setName('gamble')
  .setDescription('Play various gambling games')
  .setDescriptionLocalizations({
    'es-ES': 'Juega varios juegos de azar',
    fr: 'Jouez à divers jeux de hasard',
    de: 'Spiele verschiedene Glücksspiele',
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
  );

export const category = CommandCategory.Economy;
export const cooldown = 3;

// Additional validation schema for gambling-specific checks
const gamblingSchema = CommandSchemas.economy.gamble;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const subcommand = interaction.options.getSubcommand();
  const bet = interaction.options.getInteger('bet', true);
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    // Validate gambling input
    Validator.validate(gamblingSchema, {
      amount: bet,
      game: subcommand as any,
    });

    // Additional security check for gambling addiction protection
    const recentGambles = await economyRepository.getRecentGambles(userId, guildId, 3600); // Last hour
    if (recentGambles >= 10) {
      throw new RateLimitError(
        'You have been gambling too frequently. Please take a break and try again later.',
        3600
      );
    }

    const settings = await economyRepository.ensureSettings(guildId);

    // Check balance before allowing bet
    const userBalance = await economyRepository.getBalance(userId, guildId);
    if (!userBalance || userBalance.balance < bet) {
      await interaction.editReply({
        embeds: [
          embedBuilder.createErrorEmbed(
            `Insufficient balance. You have ${settings.currencySymbol}${userBalance?.balance.toLocaleString() || 0}`
          ),
        ],
      });
      return;
    }

    if (bet < settings.minBet || bet > settings.maxBet) {
      await interaction.editReply({
        embeds: [
          embedBuilder.createErrorEmbed(
            `Bet must be between ${settings.currencySymbol}${settings.minBet} and ${settings.currencySymbol}${settings.maxBet}`
          ),
        ],
      });
      return;
    }

    // Log gambling attempt for security monitoring
    await auditLogger.logAction({
      action: 'ECONOMY_GAMBLE_ATTEMPT',
      userId,
      guildId,
      details: {
        game: subcommand,
        amount: bet,
        balance: userBalance?.balance || 0,
      },
    });

    let result;
    let embed: EmbedBuilder;

    switch (subcommand) {
      case 'dice':
        result = await economyGamblingService.playDice(userId, guildId, bet);
        embed = createDiceEmbed(result, settings);
        break;

      case 'coinflip':
        const choice = interaction.options.getString('choice', true) as 'heads' | 'tails';
        result = await economyGamblingService.playCoinflip(userId, guildId, bet, choice);
        embed = createCoinflipEmbed(result, settings);
        break;

      case 'slots':
        result = await economyGamblingService.playSlots(userId, guildId, bet);
        embed = createSlotsEmbed(result, settings);
        break;

      case 'blackjack':
        result = await economyGamblingService.playBlackjack(userId, guildId, bet);
        embed = createBlackjackEmbed(result, settings, interaction.user.displayAvatarURL());
        break;

      case 'roulette':
        const betType = interaction.options.getString('type', true);
        let rouletteBetType: string;
        let betValue: string | number | undefined;

        if (betType.startsWith('color:')) {
          rouletteBetType = 'color';
          betValue = betType.split(':')[1];
        } else if (betType.startsWith('dozen:')) {
          rouletteBetType = 'dozen';
          betValue = betType.split(':')[1];
        } else if (betType === 'number') {
          rouletteBetType = 'number';
          const numberBet = interaction.options.getInteger('number');
          if (numberBet === null) {
            await interaction.editReply({
              embeds: [embedBuilder.createErrorEmbed('Please specify a number to bet on (0-36)')],
            });
            return;
          }
          betValue = numberBet;
        } else {
          rouletteBetType = betType;
        }

        result = await economyGamblingService.playRoulette(
          userId,
          guildId,
          bet,
          rouletteBetType,
          betValue
        );
        embed = createRouletteEmbed(result, settings);
        break;

      default:
        await interaction.editReply({
          embeds: [embedBuilder.createErrorEmbed('Invalid gambling game')],
        });
        return;
    }

    // Log gambling result for security monitoring
    await auditLogger.logAction({
      action: 'ECONOMY_GAMBLE_RESULT',
      userId,
      guildId,
      details: {
        game: subcommand,
        bet,
        profit: result.profit,
        newBalance: result.balance.balance,
        won: result.profit > 0,
      },
    });

    // Check for suspicious winning patterns
    if (result.profit > bet * 10) {
      await auditLogger.logAction({
        action: 'ECONOMY_SUSPICIOUS_WIN',
        userId,
        guildId,
        details: {
          game: subcommand,
          bet,
          profit: result.profit,
          multiplier: result.profit / bet,
        },
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error in gamble command:', error);

    // Don't expose internal errors to users
    const userMessage =
      error instanceof RateLimitError
        ? error.message
        : 'Failed to process gambling game. Please try again later.';

    await interaction.editReply({
      embeds: [embedBuilder.createErrorEmbed(userMessage)],
    });
  }
}

function createDiceEmbed(result: any, settings: any): EmbedBuilder {
  const details = result.details as DiceResult;
  const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  return new EmbedBuilder()
    .setTitle('🎲 Dice Game')
    .setDescription(details.tie ? "It's a tie!" : details.won ? 'You won!' : 'You lost!')
    .setColor(details.won ? 0x2ecc71 : details.tie ? 0xf39c12 : 0xe74c3c)
    .addFields(
      {
        name: 'Your Roll',
        value: `${diceEmojis[details.playerRoll - 1]} ${details.playerRoll}`,
        inline: true,
      },
      {
        name: 'Dealer Roll',
        value: `${diceEmojis[details.dealerRoll - 1]} ${details.dealerRoll}`,
        inline: true,
      },
      {
        name: 'Result',
        value:
          result.profit > 0
            ? `Won ${settings.currencySymbol}${result.profit.toLocaleString()}`
            : result.profit === 0
              ? 'Push'
              : `Lost ${settings.currencySymbol}${Math.abs(result.profit).toLocaleString()}`,
        inline: true,
      },
      {
        name: 'New Balance',
        value: `${settings.currencySymbol}${result.balance.balance.toLocaleString()}`,
        inline: true,
      }
    )
    .setFooter({
      text: `Win Rate: ${((result.stats.gamesWon / result.stats.gamesPlayed) * 100).toFixed(1)}% | Streak: ${result.stats.currentStreak}`,
    })
    .setTimestamp();
}

function createCoinflipEmbed(result: any, settings: any): EmbedBuilder {
  const details = result.details as CoinflipResult;
  const emoji = details.result === 'heads' ? '🪙' : '🪙';

  return new EmbedBuilder()
    .setTitle(`${emoji} Coinflip`)
    .setDescription(`The coin landed on **${details.result}**!`)
    .setColor(details.won ? 0x2ecc71 : 0xe74c3c)
    .addFields(
      {
        name: 'Your Choice',
        value: details.choice.charAt(0).toUpperCase() + details.choice.slice(1),
        inline: true,
      },
      {
        name: 'Result',
        value: details.result.charAt(0).toUpperCase() + details.result.slice(1),
        inline: true,
      },
      {
        name: details.won ? 'Won' : 'Lost',
        value: `${settings.currencySymbol}${Math.abs(result.profit).toLocaleString()}`,
        inline: true,
      },
      {
        name: 'New Balance',
        value: `${settings.currencySymbol}${result.balance.balance.toLocaleString()}`,
        inline: true,
      }
    )
    .setFooter({
      text: `Win Rate: ${((result.stats.gamesWon / result.stats.gamesPlayed) * 100).toFixed(1)}% | Streak: ${result.stats.currentStreak}`,
    })
    .setTimestamp();
}

function createSlotsEmbed(result: any, settings: any): EmbedBuilder {
  const details = result.details as SlotsResult;

  const embed = new EmbedBuilder()
    .setTitle('🎰 Slot Machine')
    .setDescription(`**${details.reels.join(' | ')}**`)
    .setColor(details.won ? 0x2ecc71 : 0xe74c3c)
    .addFields(
      {
        name: 'Result',
        value: details.won
          ? details.winType === 'jackpot'
            ? '💰 JACKPOT! 💰'
            : details.winType === 'triple'
              ? '🎉 Triple Match!'
              : '✨ Double Match!'
          : 'No match',
        inline: true,
      },
      {
        name: details.won ? 'Won' : 'Lost',
        value: `${settings.currencySymbol}${Math.abs(result.profit).toLocaleString()}`,
        inline: true,
      },
      {
        name: 'New Balance',
        value: `${settings.currencySymbol}${result.balance.balance.toLocaleString()}`,
        inline: true,
      }
    )
    .setFooter({
      text: `Win Rate: ${((result.stats.gamesWon / result.stats.gamesPlayed) * 100).toFixed(1)}% | Best Win: ${settings.currencySymbol}${result.stats.biggestWin}`,
    })
    .setTimestamp();

  if (details.winType === 'jackpot') {
    embed.addFields({
      name: '🎊 Congratulations!',
      value: `You hit the JACKPOT with triple 7s! ${details.multiplier}x multiplier!`,
      inline: false,
    });
  }

  return embed;
}

function createBlackjackEmbed(result: any, settings: any, avatarUrl: string): EmbedBuilder {
  const details = result.details as BlackjackResult;

  const formatHand = (hand: any) => {
    return hand.cards.map((c: any) => `${c.rank}${c.suit}`).join(' ');
  };

  const embed = new EmbedBuilder()
    .setTitle('🃏 Blackjack')
    .setThumbnail(avatarUrl)
    .setColor(details.won ? 0x2ecc71 : details.push ? 0xf39c12 : 0xe74c3c)
    .addFields(
      {
        name: 'Your Hand',
        value: `${formatHand(details.playerHand)}\nValue: ${details.playerHand.value}${details.playerHand.blackjack ? ' - Blackjack!' : ''}${details.playerHand.bust ? ' - Bust!' : ''}`,
        inline: true,
      },
      {
        name: 'Dealer Hand',
        value: `${formatHand(details.dealerHand)}\nValue: ${details.dealerHand.value}${details.dealerHand.blackjack ? ' - Blackjack!' : ''}${details.dealerHand.bust ? ' - Bust!' : ''}`,
        inline: true,
      },
      {
        name: 'Result',
        value: details.push ? 'Push' : details.won ? 'You won!' : 'You lost!',
        inline: false,
      },
      {
        name: details.won ? 'Won' : details.push ? 'Returned' : 'Lost',
        value: `${settings.currencySymbol}${Math.abs(result.profit).toLocaleString()}`,
        inline: true,
      },
      {
        name: 'New Balance',
        value: `${settings.currencySymbol}${result.balance.balance.toLocaleString()}`,
        inline: true,
      }
    )
    .setFooter({
      text: `Win Rate: ${((result.stats.gamesWon / result.stats.gamesPlayed) * 100).toFixed(1)}% | Games Played: ${result.stats.gamesPlayed}`,
    })
    .setTimestamp();

  if (details.blackjack && details.won) {
    embed.setDescription('🎊 **BLACKJACK!** You got 21 with your first two cards!');
  }

  return embed;
}

function createRouletteEmbed(result: any, settings: any): EmbedBuilder {
  const details = result.details as RouletteResult;
  const colorEmoji = details.color === 'red' ? '🔴' : details.color === 'black' ? '⚫' : '🟢';

  const embed = new EmbedBuilder()
    .setTitle('🎰 Roulette')
    .setDescription(`The ball landed on **${colorEmoji} ${details.number}**`)
    .setColor(details.won ? 0x2ecc71 : 0xe74c3c)
    .addFields(
      {
        name: 'Your Bet',
        value: `${details.betType.charAt(0).toUpperCase() + details.betType.slice(1)}`,
        inline: true,
      },
      {
        name: 'Result',
        value: `${details.number} (${details.color})`,
        inline: true,
      },
      {
        name: details.won ? 'Won' : 'Lost',
        value: `${settings.currencySymbol}${Math.abs(result.profit).toLocaleString()}`,
        inline: true,
      },
      {
        name: 'Multiplier',
        value: `${details.multiplier}x`,
        inline: true,
      },
      {
        name: 'New Balance',
        value: `${settings.currencySymbol}${result.balance.balance.toLocaleString()}`,
        inline: true,
      }
    )
    .setFooter({
      text: `Win Rate: ${((result.stats.gamesWon / result.stats.gamesPlayed) * 100).toFixed(1)}% | Total Wagered: ${settings.currencySymbol}${result.stats.totalWagered}`,
    })
    .setTimestamp();

  return embed;
}
