import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { economyService } from '../../services/economyService';
import { economyRepository } from '../../repositories/economyRepository';
import { embedBuilder } from '../../handlers/embedBuilder';

export const data = new SlashCommandBuilder()
  .setName('work')
  .setDescription('Work to earn money')
  .setDescriptionLocalizations({
    'es-ES': 'Trabaja para ganar dinero',
    'fr': 'Travaillez pour gagner de l\'argent',
    'de': 'Arbeite um Geld zu verdienen',
  });

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    const result = await economyService.work(userId, guildId);
    
    if (!result.success) {
      await interaction.editReply({
        embeds: [embedBuilder.createErrorEmbed(result.error!)]
      });
      return;
    }

    const settings = await economyRepository.ensureSettings(guildId);
    
    const embed = new EmbedBuilder()
      .setTitle('Work Complete!')
      .setDescription(result.transaction!.description!)
      .setColor(0x3498db)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { 
          name: 'Earned', 
          value: `${settings.currencySymbol} ${result.transaction!.amount.toLocaleString()}`, 
          inline: true 
        },
        { 
          name: 'New Balance', 
          value: `${settings.currencySymbol} ${result.balance!.balance.toLocaleString()}`, 
          inline: true 
        }
      )
      .setFooter({ text: `You can work again in ${settings.workCooldown / 60} minutes` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in work command:', error);
    await interaction.editReply({
      embeds: [embedBuilder.createErrorEmbed('Failed to complete work. Please try again later.')]
    });
  }
}