import { SlashCommandBuilder } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, formatNumber } from '../../utils/helpers';
import { economyHandler } from '../../handlers/economy';
import { colors, emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('Gamble your coins in various games')
    .addSubcommand(subcommand =>
      subcommand
        .setName('coinflip')
        .setDescription('Flip a coin - double or nothing!')
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Amount to bet')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('dice')
        .setDescription('Roll a dice - higher numbers win more!')
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Amount to bet')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('slots')
        .setDescription('Spin the slot machine!')
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Amount to bet')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .setDMPermission(false);

export async function execute(interaction: any) {
    if (!interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();
    const amount = interaction.options.getInteger('amount', true);

    await interaction.deferReply();

    try {
      // Check if user has enough coins
      const user = await economyHandler.getUser(interaction.user.id, interaction.guild.id);
      if (user.coins < amount) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Insufficient Funds', 'You don\'t have enough coins to make this bet.')],
        });
      }

      const result = await economyHandler.gamble(
        interaction.user.id, 
        interaction.guild.id, 
        amount, 
        subcommand as any
      );

      let embed;
      
      if (result.won) {
        embed = createSuccessEmbed(
          `${emojis.tada} You Won!`,
          getGameResultText(subcommand, result, amount)
        );
        embed.setColor(colors.success as any);
        embed.addFields({
          name: '💰 Winnings',
          value: `+${formatNumber(result.amount)} coins`,
          inline: true,
        });
      } else {
        embed = createErrorEmbed(
          `${emojis.error} You Lost!`,
          getGameResultText(subcommand, result, amount)
        );
        embed.addFields({
          name: '💸 Lost',
          value: `${formatNumber(result.amount)} coins`,
          inline: true,
        });
      }

      embed.addFields({
        name: '🎲 Result',
        value: formatGameResult(subcommand, result),
        inline: true,
      });

      if (result.multiplier > 0) {
        embed.addFields({
          name: '🔢 Multiplier',
          value: `${result.multiplier}x`,
          inline: true,
        });
      }

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error gambling:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', error instanceof Error ? error.message : 'Failed to process bet.')],
      });
    }
  }

function getGameResultText(game: string, result: any, amount: number): string {
    switch (game) {
      case 'coinflip':
        return `The coin landed on **${result.result.flip}**!`;
      
      case 'dice':
        const roll = result.result.roll;
        if (roll === 6) return `Perfect roll! You got a **${roll}**!`;
        if (roll >= 4) return `Nice roll! You got a **${roll}**!`;
        return `You rolled a **${roll}**. Better luck next time!`;
      
      case 'slots':
        const slots = result.result.slots.join(' ');
        if (result.won) {
          if (result.result.slots[0] === result.result.slots[1] && result.result.slots[1] === result.result.slots[2]) {
            return `**JACKPOT!** ${slots}\nThree of a kind!`;
          } else {
            return `**WIN!** ${slots}\nTwo matching symbols!`;
          }
        }
        return `${slots}\nNo matching symbols.`;
      
      default:
        return '';
    }
  }

function formatGameResult(game: string, result: any): string {
    switch (game) {
      case 'coinflip':
        return `🪙 ${result.result.flip.charAt(0).toUpperCase() + result.result.flip.slice(1)}`;
      
      case 'dice':
        return `🎲 ${result.result.roll}`;
      
      case 'slots':
        return result.result.slots.join(' ');
      
      default:
        return '';
    }
  }