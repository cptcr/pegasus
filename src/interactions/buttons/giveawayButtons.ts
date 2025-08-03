import { 
  ButtonInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle 
} from 'discord.js';
import { giveawayService } from '../../services/giveawayService';
import { giveawayRepository } from '../../repositories/giveawayRepository';
import { t } from '../../i18n';

export async function handleGiveawayButtons(interaction: ButtonInteraction) {
  const [action, giveawayId] = interaction.customId.split(':');

  switch (action) {
    case 'gw_enter':
      return handleGiveawayEnter(interaction, giveawayId);
    case 'gw_info':
      return handleGiveawayInfo(interaction, giveawayId);
  }
}

async function handleGiveawayEnter(interaction: ButtonInteraction, giveawayId: string) {
  await interaction.deferReply({ ephemeral: true });

  // Check if user is already entered
  const existingEntry = await giveawayRepository.getUserEntry(giveawayId, interaction.user.id);
  
  if (existingEntry) {
    // User wants to leave
    const result = await giveawayService.removeEntry(giveawayId, interaction.user.id);
    
    if (result.success) {
      await interaction.editReply({
        content: t('commands.giveaway.interactions.left'),
      });
    } else {
      await interaction.editReply({
        content: result.error || t('commands.giveaway.error'),
      });
    }
  } else {
    // User wants to enter
    const result = await giveawayService.enterGiveaway(
      giveawayId, 
      interaction.user.id,
      interaction.guild!
    );

    if (result.success) {
      await interaction.editReply({
        content: t('commands.giveaway.interactions.entered', { entries: result.entries }),
      });
    } else {
      await interaction.editReply({
        content: result.error || t('commands.giveaway.error'),
      });
    }
  }

  // Update button count
  await updateButtonCount(interaction, giveawayId);
}

async function handleGiveawayInfo(interaction: ButtonInteraction, giveawayId: string) {
  await interaction.deferReply({ ephemeral: true });

  const giveaway = await giveawayRepository.getGiveaway(giveawayId);
  if (!giveaway) {
    return interaction.editReply({
      content: t('commands.giveaway.notFound'),
    });
  }

  const userEntry = await giveawayRepository.getUserEntry(giveawayId, interaction.user.id);
  const stats = await giveawayRepository.getUserGiveawayStats(interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(t('commands.giveaway.info.title'))
    .setDescription(t('commands.giveaway.info.description', { prize: giveaway.prize }))
    .addFields(
      {
        name: t('commands.giveaway.info.status'),
        value: giveaway.status === 'active' 
          ? t('commands.giveaway.info.statusActive')
          : t('commands.giveaway.info.statusEnded'),
        inline: true,
      },
      {
        name: t('commands.giveaway.info.entries'),
        value: giveaway.entries.toString(),
        inline: true,
      },
      {
        name: t('commands.giveaway.info.winners'),
        value: giveaway.winnerCount.toString(),
        inline: true,
      },
      {
        name: t('commands.giveaway.info.yourEntries'),
        value: userEntry ? userEntry.entries.toString() : '0',
        inline: true,
      },
      {
        name: t('commands.giveaway.info.yourStats'),
        value: t('commands.giveaway.info.statsValue', { 
          entries: stats.totalEntries, 
          wins: stats.totalWins 
        }),
        inline: true,
      }
    )
    .setFooter({
      text: t('commands.giveaway.info.footer', { id: giveaway.giveawayId }),
    })
    .setTimestamp();

  if (giveaway.description) {
    embed.setDescription(giveaway.description);
  }

  // Add requirements if any
  if (giveaway.requirements && Object.keys(giveaway.requirements).length > 0) {
    const reqLines = [];
    if (giveaway.requirements.roleIds?.length > 0) {
      reqLines.push(`• Roles: ${giveaway.requirements.roleIds.map((id: string) => `<@&${id}>`).join(', ')}`);
    }
    if (giveaway.requirements.minLevel) {
      reqLines.push(`• Minimum Level: ${giveaway.requirements.minLevel}`);
    }
    if (giveaway.requirements.minTimeInServer) {
      reqLines.push(`• Time in Server: ${giveaway.requirements.minTimeInServer}`);
    }
    if (reqLines.length > 0) {
      embed.addFields({
        name: t('commands.giveaway.info.requirements'),
        value: reqLines.join('\n'),
        inline: false,
      });
    }
  }

  // Add bonus entries if any
  if (giveaway.bonusEntries && Object.keys(giveaway.bonusEntries).length > 0) {
    const bonusLines = [];
    if (giveaway.bonusEntries.roles) {
      for (const [roleId, multiplier] of Object.entries(giveaway.bonusEntries.roles)) {
        bonusLines.push(`• <@&${roleId}>: ${multiplier}x entries`);
      }
    }
    if (giveaway.bonusEntries.booster) {
      bonusLines.push(`• Server Booster: ${giveaway.bonusEntries.booster}x entries`);
    }
    if (bonusLines.length > 0) {
      embed.addFields({
        name: t('commands.giveaway.info.bonusEntries'),
        value: bonusLines.join('\n'),
        inline: false,
      });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

async function updateButtonCount(interaction: ButtonInteraction, giveawayId: string) {
  try {
    const giveaway = await giveawayRepository.getGiveaway(giveawayId);
    if (!giveaway || !giveaway.messageId) return;

    const message = interaction.message;
    if (!message.editable) return;

    // Update button label with entry count
    const components = message.components[0].components as ButtonBuilder[];
    const enterButton = components.find(c => c.data.custom_id?.startsWith('gw_enter:'));
    
    if (enterButton) {
      const newButton = ButtonBuilder.from(enterButton)
        .setLabel(`${t('commands.giveaway.buttons.enter')} (${giveaway.entries})`);
      
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        newButton,
        ...components.filter(c => !c.data.custom_id?.startsWith('gw_enter:'))
      );

      await message.edit({ components: [row] });
    }
  } catch (error) {
    // Silently fail - not critical
  }
}