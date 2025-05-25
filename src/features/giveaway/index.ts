import { ClientWithCommands, Feature } from '../../types';
import { EmbedBuilder, TextChannel, ButtonStyle, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { getGuildSettings } from '../../utils/guildSettings';
import ms from 'ms';

interface ActiveGiveaway {
  messageId: string;
  channelId: string;
  guildId: string;
  prize: string;
  winnerCount: number;
  endTime: number;
  participants: Set<string>;
  creatorId: string;
  ended: boolean;
  timer?: NodeJS.Timeout;
}

const activeGiveaways = new Map<string, ActiveGiveaway>();

async function endGiveaway(client: ClientWithCommands, giveaway: ActiveGiveaway) {
  if (giveaway.ended) return;
  giveaway.ended = true;
  if (giveaway.timer) clearTimeout(giveaway.timer);

  const channel = await client.channels.fetch(giveaway.channelId) as TextChannel | null;
  if (!channel) return;

  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!message) return;

  const participantsArray = Array.from(giveaway.participants);
  const winners: string[] = [];

  if (participantsArray.length > 0) {
    for (let i = 0; i < giveaway.winnerCount; i++) {
      if (participantsArray.length === 0) break;
      const randomIndex = Math.floor(Math.random() * participantsArray.length);
      winners.push(participantsArray.splice(randomIndex, 1)[0]);
    }
  }

  const endedEmbed = EmbedBuilder.from(message.embeds[0])
    .setTitle(`🎉 Giveaway Beendet: ${giveaway.prize} 🎉`)
    .setDescription(
      winners.length > 0
        ? `Herzlichen Glückwunsch an ${winners.map(w => `<@${w}>`).join(', ')}! Ihr habt gewonnen: **${giveaway.prize}**`
        : 'Leider gab es keine Teilnehmer oder nicht genügend, um alle Gewinner zu ziehen.'
    )
    .setColor(0xAAAAAA)
    .setFields([])
    .addFields({ name: 'Gewinner', value: winners.length > 0 ? winners.map(w => `<@${w}>`).join('\n') : 'Keine Gewinner' })
    .setTimestamp();

  const endedRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_ended_${giveaway.messageId}`)
        .setLabel('Giveaway Beendet')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

  await message.edit({ embeds: [endedEmbed], components: [endedRow] });

  if (winners.length > 0) {
    await channel.send(`Herzlichen Glückwunsch ${winners.map(w => `<@${w}>`).join(', ')}! Ihr habt **${giveaway.prize}** gewonnen!`);
  } else {
    await channel.send(`Das Giveaway für **${giveaway.prize}** ist beendet. Es gab leider keine Gewinner.`);
  }

  activeGiveaways.delete(giveaway.messageId);
  await client.prisma.giveaway.updateMany({
    where: { messageId: giveaway.messageId, guildId: giveaway.guildId },
    data: { ended: true, active: false, winners: winners.length }
  });
}

const giveawaysFeature: Feature = {
  name: 'giveaways',
  description: 'Verwaltet Giveaways und Verlosungen.',
  enabled: true,
  async initialize(client: ClientWithCommands) {
    if (!client.config.enabledFeatures.giveaways) {
      return;
    }

    const existingGiveaways = await client.prisma.giveaway.findMany({
        where: { ended: false, active: true }
    });

    for (const dbGiveaway of existingGiveaways) {
        if (dbGiveaway.endTime.getTime() > Date.now()) {
            const giveawayData: ActiveGiveaway = {
                messageId: dbGiveaway.messageId!,
                channelId: dbGiveaway.channelId,
                guildId: dbGiveaway.guildId,
                prize: dbGiveaway.prize,
                winnerCount: dbGiveaway.winners,
                endTime: dbGiveaway.endTime.getTime(),
                participants: new Set((dbGiveaway as any).entries || []),
                creatorId: dbGiveaway.creatorId,
                ended: false,
            };
            giveawayData.timer = setTimeout(() => endGiveaway(client, giveawayData), dbGiveaway.endTime.getTime() - Date.now());
            activeGiveaways.set(dbGiveaway.messageId!, giveawayData);
        } else {
            endGiveaway(client, {
                messageId: dbGiveaway.messageId!,
                channelId: dbGiveaway.channelId,
                guildId: dbGiveaway.guildId,
                prize: dbGiveaway.prize,
                winnerCount: dbGiveaway.winners,
                endTime: dbGiveaway.endTime.getTime(),
                participants: new Set((dbGiveaway as any).entries || []),
                creatorId: dbGiveaway.creatorId,
                ended: true,
            });
        }
    }


    client.on('interactionCreate', async interaction => {
      if (!interaction.isButton() || !interaction.guildId) return;
      if (!interaction.customId.startsWith('giveaway_join_')) return;

      const guildSettings = await getGuildSettings(interaction.guildId, client);
      if (!guildSettings.enableGiveaways) return;

      const messageId = interaction.customId.replace('giveaway_join_', '');
      const giveaway = activeGiveaways.get(messageId);

      if (!giveaway || giveaway.ended) {
        await interaction.reply({ content: 'Dieses Giveaway ist nicht mehr aktiv oder wurde nicht gefunden.', ephemeral: true });
        return;
      }

      if (giveaway.participants.has(interaction.user.id)) {
        giveaway.participants.delete(interaction.user.id);
        await interaction.reply({ content: 'Du hast deine Teilnahme am Giveaway zurückgezogen.', ephemeral: true });
      } else {
        giveaway.participants.add(interaction.user.id);
        await interaction.reply({ content: 'Du nimmst jetzt am Giveaway teil! Viel Glück!', ephemeral: true });
      }

      const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
      if (message) {
          const row = message.components[0] as unknown as ActionRowBuilder<ButtonBuilder>;
          if (row && row.components[0]) {
            const newButton = ButtonBuilder.from(row.components[0])
                                .setLabel(`Teilnehmen (${giveaway.participants.size})`);
            const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(newButton);
            await message.edit({ components: [newRow] }).catch(console.error);

             await client.prisma.giveaway.update({
                where: { id: parseInt(messageId) },
                data: { 
                    entries: {
                        set: Array.from(giveaway.participants).map(participant => ({
                            giveawayId_userId: {
                                giveawayId: parseInt(messageId),
                                userId: participant
                            }
                        }))
                    }
                }
            }).catch(console.error);
          }
      }
    });
  },
  async shutdown(client: ClientWithCommands) {
    activeGiveaways.forEach(giveaway => {
        if (giveaway.timer) clearTimeout(giveaway.timer);
    });
    activeGiveaways.clear();
  }
};

export { activeGiveaways, endGiveaway, setActiveGiveawaysMapEntry };

function setActiveGiveawaysMapEntry(messageId: string, data: ActiveGiveaway) {
    activeGiveaways.set(messageId, data);
}

export default giveawaysFeature;