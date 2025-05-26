// src/features/polls/index.ts
import { ClientWithCommands, Feature, PollData as InternalPollData } from '../../types';
import { getGuildSettings } from '../../utils/guildSettings';
import { Events, MessageReaction, User, PartialMessageReaction, PartialUser, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, Interaction } from 'discord.js';
import { Prisma } from '@prisma/client';

// Die `activePolls`-Map speichert jetzt detailliertere Objekte
const activePolls = new Map<string, InternalPollData & { timerId?: NodeJS.Timeout }>();

function getEmojiForIndex(index: number): string {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[index] || '☑️';
}

export async function endPoll(client: ClientWithCommands, pollId: string | number, guildId: string, reason?: string) {
    const pollMessageId = typeof pollId === 'number'
        ? (await client.prisma.poll.findUnique({ where: { id: pollId } }))?.messageId
        : pollId;

    if (!pollMessageId) return;

    const pollData = activePolls.get(pollMessageId);
    if (!pollData || !pollData.active) return;

    pollData.active = false;
    if (pollData.timerId) {
        clearTimeout(pollData.timerId);
    }

    const channel = await client.channels.fetch(pollData.channelId) as TextChannel | null;
    if (!channel) {
        console.error(`Poll End: Channel ${pollData.channelId} not found.`);
        // Poll in DB als inaktiv markieren, auch wenn Kanal nicht gefunden wird
        await client.prisma.poll.update({
            where: { id: typeof pollId === 'number' ? pollId : undefined },
            data: { active: false },
        }).catch(e => console.error("DB Error ending poll without channel:", e));
        activePolls.delete(pollMessageId);
        return;
    }

    const message = await channel.messages.fetch(pollMessageId).catch(() => null);
    if (!message || message.embeds.length === 0) {
         console.error(`Poll End: Message ${pollMessageId} not found or no embeds.`);
         await client.prisma.poll.update({
            where: { id: typeof pollId === 'number' ? pollId : undefined },
            data: { active: false },
        }).catch(e => console.error("DB Error ending poll without message:", e));
        activePolls.delete(pollMessageId);
        return;
    }

    const finalEmbed = EmbedBuilder.from(message.embeds[0]);
    finalEmbed.setTitle(`📊 Umfrage BEENDET: ${pollData.title}`);
    finalEmbed.setDescription(reason ? `Diese Umfrage wurde beendet.\nGrund: ${reason}\n\nErgebnisse:` : 'Die Abstimmung ist beendet. Hier sind die Ergebnisse:');
    finalEmbed.setTimestamp(new Date());

    const dbVotes = await client.prisma.pollVote.groupBy({
        by: ['optionId'],
        _count: {
            userId: true,
        },
        where: { pollId: pollData.id },
    });

    const voteCounts = new Map<number, number>();
    dbVotes.forEach(voteGroup => {
        voteCounts.set(voteGroup.optionId, voteGroup._count.userId);
    });

    const finalFields = pollData.options.map((opt, index) => {
        const voteCount = voteCounts.get(opt.id) || 0;
        return { name: `${getEmojiForIndex(index)} ${opt.text}`, value: `${voteCount} Stimme${voteCount === 1 ? '' : 'n'}`, inline: false };
    });
    finalEmbed.setFields(finalFields);

    const finalComponents: ActionRowBuilder<ButtonBuilder>[] = []; // Keine Buttons nach Ende

    try {
        await message.edit({ embeds: [finalEmbed], components: finalComponents });
        if (reason) {
            await channel.send(`Die Umfrage "${pollData.title}" wurde beendet. ${reason}`).catch(console.error);
        } else {
            await channel.send(`Die Umfrage "${pollData.title}" ist beendet!`).catch(console.error);
        }
    } catch (e) {
        console.error("Fehler beim Aktualisieren der beendeten Umfrage:", e);
    }

    await client.prisma.poll.update({
          where: { id: (await client.prisma.poll.findFirst({ where: { messageId: pollMessageId } }))?.id ?? undefined },
        data: { active: false },
    });
    activePolls.delete(pollMessageId);
}


const pollsFeature: Feature = {
  name: 'polls',
  description: 'Ermöglicht Benutzern das Erstellen und Teilnehmen an Umfragen.',
  enabled: true, // gesteuert durch client.config.enabledFeatures.polls
  async initialize(client: ClientWithCommands) {
    if (!client.config.enabledFeatures.polls) {
      return;
    }
    console.log("🗳️ Polls Feature wird initialisiert...");

    // Bestehende aktive Umfragen aus der DB laden
    const dbActivePolls = await client.prisma.poll.findMany({
        where: { active: true, AND: [{ endTime: { gt: new Date() } }] },
        include: { options: true } // Ensure options are included in the query
    });

    for (const dbPoll of dbActivePolls) {
        if (dbPoll.endTime && dbPoll.endTime.getTime() > Date.now()) {
            const pollData: InternalPollData & { timerId?: NodeJS.Timeout } = {
                id: dbPoll.id,
                messageId: dbPoll.messageId ?? '',
                channelId: dbPoll.channelId,
                guildId: dbPoll.guildId,
                title: dbPoll.title,
                creatorId: dbPoll.creatorId,
                multiple: dbPoll.multiple,
                anonymous: dbPoll.anonymous,
                active: true,
                endsAt: dbPoll.endTime,
                options: dbPoll.options.map((opt: { id: any; text: any; emoji: any; }) => ({id: opt.id, text: opt.text, emoji: opt.emoji || undefined})),
                // Stimmen werden nicht persistent in der Map gehalten, sondern bei Bedarf aus der DB gelesen
            };
            if (dbPoll.messageId) {
                pollData.timerId = setTimeout(() => endPoll(client, dbPoll.messageId!, dbPoll.guildId), dbPoll.endTime!.getTime() - Date.now());
            } else {
                console.error(`Poll ${dbPoll.id} has no messageId and cannot be scheduled.`);
            }
            if (dbPoll.messageId) {
                activePolls.set(dbPoll.messageId, pollData);
            } else {
                console.error(`Poll ${dbPoll.id} has no messageId and cannot be added to activePolls.`);
            }
            console.log(`Lade aktive Umfrage: ${dbPoll.title} (endet ${dbPoll.endTime})`)
        } else if (dbPoll.endTime && dbPoll.endTime.getTime() <= Date.now()) {
            // Umfrage ist abgelaufen, beende sie
            console.log(`Beende abgelaufene Umfrage beim Start: ${dbPoll.title}`);
            if (dbPoll.messageId) {
                await endPoll(client, dbPoll.messageId, dbPoll.guildId, "Automatisch beendet da abgelaufen.");
            } else {
                console.error(`Poll ${dbPoll.id} has no messageId and cannot be ended.`);
            }
        }
    }

    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      if (!interaction.isButton() || !interaction.guildId || !interaction.channel) return;
      if (!interaction.customId.startsWith('poll_vote_')) return;

      const guildSettings = await getGuildSettings(interaction.guildId, client);
      if (!guildSettings.enablePolls) {
        await interaction.reply({ content: "Das Umfragesystem ist hier deaktiviert.", ephemeral: true });
        return;
      }

      const parts = interaction.customId.split('_');
      const pollMessageId = parts[2];
      const optionId = parseInt(parts[3]);

      const pollData = activePolls.get(pollMessageId);
      const dbPoll = await client.prisma.poll.findUnique({
          where: { id: (await client.prisma.poll.findUnique({ where: { messageId: pollMessageId } }))?.id },
          include: { options: true }
      });

      if (!dbPoll || !dbPoll.active) {
        await interaction.reply({ content: 'Diese Umfrage ist nicht mehr aktiv oder wurde nicht gefunden.', ephemeral: true });
        return;
      }
      if (dbPoll.endsAt && new Date() > dbPoll.endsAt) {
        await interaction.reply({ content: 'Diese Umfrage ist bereits beendet.', ephemeral: true });
        // Optional: Umfrage hier direkt beenden, falls der Timer nicht gegriffen hat
        if (dbPoll.active) {
            await endPoll(client, pollMessageId, interaction.guildId, "Automatisch beendet (Abstimmungsversuch nach Ablauf).");
        }
        return;
      }

      const userId = interaction.user.id;
      const selectedOption = dbPoll.options.find(opt => opt.id === optionId);

      if (!selectedOption) {
        await interaction.reply({ content: 'Ungültige Option ausgewählt.', ephemeral: true });
        return;
      }

      try {
        const existingVote = await client.prisma.pollVote.findUnique({
            where: { pollId_optionId_userId: { pollId: dbPoll.id, optionId: selectedOption.id, userId } }
        });

        if (dbPoll.multiple) {
            if (existingVote) {
                await client.prisma.pollVote.delete({ where: { id: existingVote.id }});
                await interaction.reply({ content: `Deine Stimme für "${selectedOption.text}" wurde entfernt.`, ephemeral: true });
            } else {
                await client.prisma.pollVote.create({
                    data: { pollId: dbPoll.id, optionId: selectedOption.id, userId }
                });
                await interaction.reply({ content: `Deine Stimme für "${selectedOption.text}" wurde gezählt.`, ephemeral: true });
            }
        } else { // Single choice
            const userVotesForThisPoll = await client.prisma.pollVote.findMany({
                where: { pollId: dbPoll.id, userId }
            });

            if (existingVote) { // User klickt auf bereits gewählte Option -> Stimme entfernen
                await client.prisma.pollVote.delete({ where: { id: existingVote.id }});
                await interaction.reply({ content: `Deine Stimme für "${selectedOption.text}" wurde entfernt.`, ephemeral: true });
            } else { // User wählt neue Option
                // Alte Stimmen für diese Umfrage löschen, wenn vorhanden
                if (userVotesForThisPoll.length > 0) {
                    await client.prisma.pollVote.deleteMany({ where: { pollId: dbPoll.id, userId }});
                }
                await client.prisma.pollVote.create({
                    data: { pollId: dbPoll.id, optionId: selectedOption.id, userId }
                });
                await interaction.reply({ content: `Deine Stimme für "${selectedOption.text}" wurde gezählt.`, ephemeral: true });
            }
        }

        // Update message embed
        const pollMessage = await interaction.channel.messages.fetch(pollMessageId).catch(() => null);
        if (pollMessage && pollMessage.embeds.length > 0) {
            const originalEmbed = pollMessage.embeds[0];
            const newEmbed = EmbedBuilder.from(originalEmbed);

            const updatedDbVotes = await client.prisma.pollVote.groupBy({
                by: ['optionId'],
                _count: { userId: true },
                where: { pollId: dbPoll.id },
            });
            const updatedVoteCounts = new Map<number, number>();
            updatedDbVotes.forEach(vg => updatedVoteCounts.set(vg.optionId, vg._count.userId));

            const updatedFields = await Promise.all(dbPoll.options.map(async (opt, index) => {
                const voteCount = updatedVoteCounts.get(opt.id) || 0;
                let votersDisplay = "";
                if (!dbPoll.anonymous && voteCount > 0) {
                    const recentVoters = await client.prisma.pollVote.findMany({
                        where: { pollId: dbPoll.id, optionId: opt.id },
                        take: 3,
                        select: { userId: true }
                    });
                    votersDisplay = ` (${recentVoters.map(v => `<@${v.userId}>`).join(', ')}${voteCount > 3 ? ` und ${voteCount - 3} weitere` : ''})`;
                }
                return { name: `${getEmojiForIndex(index)} ${opt.text} (${voteCount} Stimme${voteCount === 1 ? '' : 'n'})${votersDisplay}`, value: ` `, inline: false };
            });
            newEmbed.setFields(updatedFields);
            await pollMessage.edit({ embeds: [newEmbed] });
        }

      } catch (dbError) {
        console.error("DB Fehler beim Abstimmen:", dbError);
        await interaction.reply({ content: 'Ein Fehler ist beim Speichern deiner Stimme aufgetreten.', ephemeral: true });
      }
    });
    console.log("👍 Polls Feature initialisiert.");
  },
  async shutdown(client: ClientWithCommands) {
    activePolls.forEach(poll => {
        if (poll.timerId) clearTimeout(poll.timerId);
    });
    activePolls.clear();
    console.log("🗳️ Polls Feature heruntergefahren.");
  }
};

export { activePolls, removeActivePoll };

export default pollsFeature;