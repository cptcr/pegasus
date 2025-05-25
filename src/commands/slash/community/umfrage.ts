import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';
import { getGuildSettings } from '../../../utils/guildSettings';
import { setActivePoll, getActivePoll, removeActivePoll } from '../../../features/polls'; // Helper import

function getEmojiForIndex(index: number): string {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[index] || '☑️';
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('umfrage')
    .setDescription('Erstellt und verwaltet Umfragen.')
    .addSubcommand(subcommand =>
        subcommand
            .setName('erstellen')
            .setDescription('Erstellt eine neue Umfrage.')
            .addStringOption(option => option.setName('frage').setDescription('Die Frage für die Umfrage.').setRequired(true))
            .addStringOption(option => option.setName('optionen').setDescription('Optionen, getrennt durch Semikolon (;). Max. 10.').setRequired(true))
            .addBooleanOption(option => option.setName('mehrfachauswahl').setDescription('Erlaube Mehrfachauswahl (Standard: Nein).').setRequired(false))
            .addBooleanOption(option => option.setName('anonym').setDescription('Anonyme Abstimmung (Standard: Nein).').setRequired(false))
            .addStringOption(option => option.setName('dauer').setDescription('Dauer der Umfrage (z.B. 1h, 30m, 2d). Standard: Unbegrenzt.').setRequired(false))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('beenden')
            .setDescription('Beendet eine laufende Umfrage.')
            .addStringOption(option => option.setName('umfrage_id').setDescription('Die Nachrichten-ID der Umfrage, die beendet werden soll.').setRequired(true))
    ),
  enabled: true,
  category: 'community',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    if (!interaction.guildId || !interaction.channel || !(interaction.channel instanceof TextChannel)) {
        await interaction.reply({ content: 'Dieser Befehl kann nur in einem Server-Textkanal verwendet werden.', ephemeral: true });
        return;
    }
    const guildSettings = await getGuildSettings(interaction.guildId, client);
    if (!guildSettings?.enablePolls) {
        await interaction.reply({ content: 'Umfragen sind auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'erstellen') {
        const question = interaction.options.getString('frage', true);
        const optionsString = interaction.options.getString('optionen', true);
        const multiple = interaction.options.getBoolean('mehrfachauswahl') || false;
        const anonymous = interaction.options.getBoolean('anonym') || false;
        const durationString = interaction.options.getString('dauer');

        const options = optionsString.split(';').map(opt => opt.trim()).filter(opt => opt.length > 0);

        if (options.length < 2 || options.length > 10) {
            await interaction.reply({ content: 'Bitte gib zwischen 2 und 10 Optionen an, getrennt durch ein Semikolon (;).', ephemeral: true });
            return;
        }

        let endsAt: number | undefined = undefined;
        let durationMs = 0;
        if (durationString) {
            const match = durationString.match(/^(\d+)([hmd])$/);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2];
                if (unit === 'm') durationMs = value * 60 * 1000;
                else if (unit === 'h') durationMs = value * 60 * 60 * 1000;
                else if (unit === 'd') durationMs = value * 24 * 60 * 60 * 1000;
                endsAt = Date.now() + durationMs;
            } else {
                await interaction.reply({ content: 'Ungültiges Zeitformat für die Dauer. Bitte benutze z.B. 30m, 2h, 1d.', ephemeral: true});
                return;
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📊 Umfrage: ${question}`)
            .setDescription(`Stimme unten ab! ${multiple ? '(Mehrfachauswahl möglich)' : ''} ${anonymous ? '(Anonyme Umfrage)' : ''}${endsAt ? `\nEndet <t:${Math.floor(endsAt / 1000)}:R>` : ''}`)
            .setTimestamp()
            .setFooter({ text: `Erstellt von ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() || undefined });

        const fields = options.map((opt, index) => ({
            name: `${getEmojiForIndex(index)} ${opt} (0 Stimmen)`,
            value: ' ',
            inline: false,
        }));
        embed.setFields(fields);

        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();
        options.forEach((opt, index) => {
            if (index > 0 && index % 5 === 0) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder<ButtonBuilder>();
            }
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_temp_${index}`) // temp ID, wird nach dem Senden ersetzt
                    .setLabel(opt.substring(0, 80)) // Max Button Label Länge
                    .setEmoji(getEmojiForIndex(index))
                    .setStyle(ButtonStyle.Secondary)
            );
        });
        rows.push(currentRow);
        
        const pollMessage = await interaction.reply({ embeds: [embed], components: rows, fetchReply: true });
        
        const pollData = {
            messageId: pollMessage.id,
            options: options,
            votes: new Map<string, string[]>(),
            multiple: multiple,
            anonymous: anonymous,
            creatorId: interaction.user.id,
            channelId: interaction.channelId,
            guildId: interaction.guildId,
            endsAt: endsAt,
        };
        setActivePoll(pollMessage.id, pollData);

        const updatedRows = rows.map(row => {
            row.components.forEach((button: ButtonBuilder) => {
                const oldCustomId = button.data.custom_id;
                if (oldCustomId && oldCustomId.startsWith('poll_temp_')) {
                    const optionIndex = oldCustomId.split('_')[2];
                    button.setCustomId(`poll_${pollMessage.id}_${optionIndex}`);
                }
            });
            return row;
        });

        await pollMessage.edit({ components: updatedRows });

        if (endsAt) {
            setTimeout(async () => {
                const currentPollData = getActivePoll(pollMessage.id);
                if (!currentPollData) return;

                const finalEmbed = EmbedBuilder.from(pollMessage.embeds[0]);
                finalEmbed.setTitle(`📊 Umfrage BEENDET: ${question}`);
                finalEmbed.setDescription('Die Abstimmung ist beendet. Hier sind die Ergebnisse:');
                const finalFields = currentPollData.options.map((opt, index) => {
                    const voteCount = currentPollData.votes.get(opt)?.length || 0;
                    return { name: `${getEmojiForIndex(index)} ${opt}`, value: `${voteCount} Stimme${voteCount === 1 ? '' : 'n'}`, inline: false };
                });
                finalEmbed.setFields(finalFields);
                
                const finalComponents: ActionRowBuilder<ButtonBuilder>[] = []; // Keine Buttons nach Ende

                try {
                    await pollMessage.edit({ embeds: [finalEmbed], components: finalComponents });
                    if (interaction.channel) {
                       await (interaction.channel as TextChannel).send(`Die Umfrage "${question}" ist beendet!`).catch(console.error);
                    }
                } catch (e) {
                    console.error("Fehler beim Aktualisieren der beendeten Umfrage:", e);
                }
                removeActivePoll(pollMessage.id);
            }, durationMs);
        }


    } else if (subcommand === 'beenden') {
        const messageIdToStop = interaction.options.getString('umfrage_id', true);
        const pollData = getActivePoll(messageIdToStop);

        if (!pollData) {
            await interaction.reply({ content: 'Keine aktive Umfrage mit dieser ID gefunden.', ephemeral: true });
            return;
        }

        if (pollData.creatorId !== interaction.user.id && ! (interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) ) {
             await interaction.reply({ content: 'Du bist nicht berechtigt, diese Umfrage zu beenden.', ephemeral: true });
            return;
        }

        const pollMessage = await interaction.channel.messages.fetch(messageIdToStop).catch(() => null);
        if (pollMessage && pollMessage.embeds.length > 0) {
            const finalEmbed = EmbedBuilder.from(pollMessage.embeds[0]);
            const originalQuestion = finalEmbed.data.title?.replace('📊 Umfrage: ', '') || 'Unbekannte Frage';
            finalEmbed.setTitle(`📊 Umfrage BEENDET: ${originalQuestion}`);
            finalEmbed.setDescription(`Diese Umfrage wurde manuell von ${interaction.user.tag} beendet. Ergebnisse:`);
            const finalFields = pollData.options.map((opt, index) => {
                const voteCount = pollData.votes.get(opt)?.length || 0;
                 return { name: `${getEmojiForIndex(index)} ${opt}`, value: `${voteCount} Stimme${voteCount === 1 ? '' : 'n'}`, inline: false };
            });
            finalEmbed.setFields(finalFields);
            
            const finalComponents: ActionRowBuilder<ButtonBuilder>[] = []; 

            await pollMessage.edit({ embeds: [finalEmbed], components: finalComponents });
            await interaction.reply({ content: `Die Umfrage "${originalQuestion}" wurde erfolgreich beendet.`, ephemeral: true });
        } else {
            await interaction.reply({ content: 'Konnte die Umfragen-Nachricht nicht finden oder bearbeiten.', ephemeral: true });
        }
        removeActivePoll(messageIdToStop);
    }
  }
};

export default command;