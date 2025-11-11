import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { economyService } from '../../services/economyService';
import { economyRepository } from '../../repositories/economyRepository';
import { embedBuilder } from '../../handlers/embedBuilder';
import { t } from '../../i18n';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription(t('commands.economy.balance.description'))
  .setNameLocalizations({
    'es-ES': 'saldo',
    fr: 'solde',
    de: 'guthaben',
  })
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
  );

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user') || interaction.user;
  const guildId = interaction.guildId!;

  try {
    const balance = await economyService.getOrCreateBalance(targetUser.id, guildId);
    const settings = await economyRepository.ensureSettings(guildId);

    // Get recent transactions
    const transactions = await economyRepository.getTransactions(targetUser.id, guildId, 5);

    const embed = new EmbedBuilder()
      .setTitle(`${settings.currencySymbol} Balance`)
      .setDescription(`**${targetUser.username}'s Balance**`)
      .setColor(0x2ecc71)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        {
          name: 'Wallet',
          value: `${settings.currencySymbol} ${balance.balance.toLocaleString()}`,
          inline: true,
        },
        {
          name: 'Bank',
          value: `${settings.currencySymbol} ${balance.bankBalance.toLocaleString()}`,
          inline: true,
        },
        {
          name: 'Net Worth',
          value: `${settings.currencySymbol} ${(balance.balance + balance.bankBalance).toLocaleString()}`,
          inline: true,
        },
        {
          name: 'Statistics',
          value:
            `Total Earned: ${settings.currencySymbol} ${balance.totalEarned.toLocaleString()}\n` +
            `Total Spent: ${settings.currencySymbol} ${balance.totalSpent.toLocaleString()}\n` +
            `Total Gambled: ${settings.currencySymbol} ${balance.totalGambled.toLocaleString()}`,
          inline: false,
        }
      )
      .setFooter({ text: `Currency: ${settings.currencyName}` })
      .setTimestamp();

    // Add recent transactions if any
    if (transactions.length > 0) {
      const transactionList = transactions
        .map(t => {
          const prefix = t.amount > 0 ? '+' : '';
          const emoji = t.amount > 0 ? '📈' : '📉';
          return `${emoji} ${prefix}${settings.currencySymbol}${Math.abs(t.amount)} - ${t.description || t.type}`;
        })
        .join('\n');

      embed.addFields({
        name: 'Recent Transactions',
        value: transactionList,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in balance command:', error);
    await interaction.editReply({
      embeds: [
        embedBuilder.createErrorEmbed('Error', 'Failed to fetch balance. Please try again later.'),
      ],
    });
  }
}
