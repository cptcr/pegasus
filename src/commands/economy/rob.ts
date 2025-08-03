import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { economyService } from '../../services/economyService';
import { economyRepository } from '../../repositories/economyRepository';
import { embedBuilder } from '../../handlers/embedBuilder';

export const data = new SlashCommandBuilder()
  .setName('rob')
  .setDescription('Attempt to rob another user')
  .setDescriptionLocalizations({
    'es-ES': 'Intenta robar a otro usuario',
    'fr': 'Tentez de voler un autre utilisateur',
    'de': 'Versuche einen anderen Benutzer auszurauben',
  })
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to rob')
      .setDescriptionLocalizations({
        'es-ES': 'El usuario a robar',
        'fr': 'L\'utilisateur à voler',
        'de': 'Der Benutzer zum Ausrauben',
      })
      .setRequired(true)
  );

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const targetUser = interaction.options.getUser('user', true);
  const guildId = interaction.guildId!;

  if (targetUser.id === userId) {
    await interaction.editReply({
      embeds: [embedBuilder.createErrorEmbed('You cannot rob yourself!')]
    });
    return;
  }

  if (targetUser.bot) {
    await interaction.editReply({
      embeds: [embedBuilder.createErrorEmbed('You cannot rob bots!')]
    });
    return;
  }

  try {
    const result = await economyService.rob(userId, targetUser.id, guildId);
    const settings = await economyRepository.ensureSettings(guildId);
    
    if (!result.success) {
      if (result.protected) {
        const embed = new EmbedBuilder()
          .setTitle('Rob Failed - Protected!')
          .setDescription(`${targetUser.username} has rob protection! You cannot rob them.`)
          .setColor(0xe74c3c)
          .setThumbnail(targetUser.displayAvatarURL())
          .setFooter({ text: 'Buy protection from the shop to protect yourself!' })
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({
          embeds: [embedBuilder.createErrorEmbed(result.error!)]
        });
      }
      return;
    }

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    if (result.amount && result.amount > 0) {
      // Successful rob
      embed
        .setTitle('Robbery Successful!')
        .setDescription(`You successfully robbed ${targetUser.username}!`)
        .setColor(0x2ecc71)
        .addFields(
          { 
            name: 'Amount Stolen', 
            value: `${settings.currencySymbol} ${result.amount.toLocaleString()}`, 
            inline: true 
          },
          { 
            name: 'Your Balance', 
            value: `${settings.currencySymbol} ${result.robberBalance!.balance.toLocaleString()}`, 
            inline: true 
          },
          { 
            name: 'Victim Balance', 
            value: `${settings.currencySymbol} ${result.victimBalance!.balance.toLocaleString()}`, 
            inline: true 
          }
        );
    } else {
      // Failed rob with fine
      embed
        .setTitle('Robbery Failed!')
        .setDescription(`You were caught trying to rob ${targetUser.username}!`)
        .setColor(0xe74c3c)
        .addFields(
          { 
            name: 'Fine', 
            value: `${settings.currencySymbol} ${Math.abs(result.amount || 0).toLocaleString()}`, 
            inline: true 
          },
          { 
            name: 'Your Balance', 
            value: `${settings.currencySymbol} ${result.robberBalance!.balance.toLocaleString()}`, 
            inline: true 
          }
        );
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in rob command:', error);
    await interaction.editReply({
      embeds: [embedBuilder.createErrorEmbed('Failed to complete robbery. Please try again later.')]
    });
  }
}