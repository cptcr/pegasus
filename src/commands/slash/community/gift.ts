import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, ChannelType } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';
import { getGuildSettings } from '../../../utils/guildSettings';
import { activeGiveaways, endGiveaway, setActiveGiveawaysMapEntry } from '../../../features/giveaways';
import ms from 'ms';

// Subcommand handlers - can be in separate files and imported if complex
async function executeErstellen(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const prize = interaction.options.getString('preis', true);
    const durationString = interaction.options.getString('dauer', true);
    const winnerCount = interaction.options.getInteger('gewinner') || 1;
    const channel = (interaction.options.getChannel('kanal') || interaction.channel) as TextChannel;

    if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: 'Bitte wähle einen gültigen Textkanal für das Giveaway.', ephemeral: true});
        return;
    }

    const durationMs = ms(durationString as ms.StringValue);
    if (!durationMs || durationMs <= 0 || durationMs > ms('30d')) { // Max 30 Tage
        await interaction.reply({ content: 'Ungültige Dauer angegeben. Beispiel: `30m`, `1h`, `2d` (Maximal 30 Tage).', ephemeral: true });
        return;
    }
    const endTime = Date.now() + durationMs;

    const embed = new EmbedBuilder()
        .setColor(0x7289DA)
        .setTitle(`🎉 Giveaway: ${prize} 🎉`)
        .setDescription(`Klicke auf den Knopf unten, um teilzunehmen!\nEndet: <t:${Math.floor(endTime / 1000)}:R>\nGewinner: ${winnerCount}`)
        .setTimestamp(endTime)
        .setFooter({ text: `Erstellt von ${interaction.user.username}` });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_join_temp_id_placeholder')
                .setLabel('Teilnehmen (0)')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎁')
        );
    
    try {
        const giveawayMessage = await channel.send({ embeds: [embed], components: [row] });
        
        const newButton = ButtonBuilder.from(row.components[0]).setCustomId(`giveaway_join_${giveawayMessage.id}`);
        const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(newButton);
        await giveawayMessage.edit({ components: [updatedRow]});

        const giveawayData: any = {
            messageId: giveawayMessage.id,
            channelId: channel.id,
            guildId: interaction.guildId!,
            prize,
            winnerCount,
            endTime,
            participants: new Set<string>(),
            creatorId: interaction.user.id,
            ended: false,
        };

        giveawayData.timer = setTimeout(() => endGiveaway(client, giveawayData), durationMs);
        setActiveGiveawaysMapEntry(giveawayMessage.id, giveawayData);

        await client.prisma.giveaway.create({
            data: {
                guildId: interaction.guildId!,
                channelId: channel.id,
                messageId: giveawayMessage.id,
                prize: prize,
                winnerCount: winnerCount,
                endTime: new Date(endTime),
                creatorId: interaction.user.id,
                active: true,
                ended: false,
                entries: { create: [] }
            }
        });

        await interaction.reply({ content: `Giveaway für "${prize}" wurde erfolgreich in ${channel.toString()} gestartet!`, ephemeral: true });

    } catch (e) {
        console.error("Fehler beim Starten des Giveaways:", e);
        await interaction.reply({ content: 'Konnte das Giveaway nicht starten. Bitte überprüfe meine Berechtigungen in diesem Kanal.', ephemeral: true });
    }
}

async function executeBeenden(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const messageId = interaction.options.getString('nachrichten_id', true);
    const giveaway = activeGiveaways.get(messageId);

    if (!giveaway || giveaway.ended) {
        await interaction.reply({ content: 'Kein aktives Giveaway mit dieser ID gefunden oder es ist bereits beendet.', ephemeral: true });
        return;
    }
     if (giveaway.creatorId !== interaction.user.id && !(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))) {
        await interaction.reply({ content: 'Nur der Ersteller oder ein Administrator kann dieses Giveaway beenden.', ephemeral: true});
        return;
    }

    await endGiveaway(client, giveaway); // endGiveaway handles DB update and map removal
    await interaction.reply({ content: `Das Giveaway für "${giveaway.prize}" wurde manuell beendet.`, ephemeral: true });
}

async function executeNeurollen(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    const messageId = interaction.options.getString('nachrichten_id', true);
    
    const dbGiveaway = await client.prisma.giveaway.findUnique({
        where: { messageId_guildId: { messageId, guildId: interaction.guildId! } }
    });

    if (!dbGiveaway || !dbGiveaway.ended) {
         await interaction.reply({ content: 'Giveaway nicht gefunden oder noch nicht beendet.', ephemeral: true });
        return;
    }
    if (dbGiveaway.creatorId !== interaction.user.id && !(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))) {
        await interaction.reply({ content: 'Nur der Ersteller oder ein Administrator kann einen Reroll durchführen.', ephemeral: true});
        return;
    }

    const participantsArray = Array.from(dbGiveaway.entries);
    const oldWinners = dbGiveaway.winners;
    const availableParticipants = participantsArray.filter(p => !oldWinners.includes(p));

    if (availableParticipants.length < dbGiveaway.winnersCount) {
        await interaction.reply({ content: 'Nicht genügend neue Teilnehmer für einen vollständigen Reroll verfügbar.', ephemeral: true});
        return;
    }
    
    const newWinners: string[] = [];
     for (let i = 0; i < dbGiveaway.winnersCount; i++) {
        if (availableParticipants.length === 0) break;
        const randomIndex = Math.floor(Math.random() * availableParticipants.length);
        newWinners.push(availableParticipants.splice(randomIndex, 1)[0]);
    }

    if (newWinners.length === 0) {
        await interaction.reply({ content: 'Konnte keine neuen Gewinner ziehen (keine neuen Teilnehmer verfügbar).', ephemeral: true});
        return;
    }

    await client.prisma.giveaway.update({
        where: { id: dbGiveaway.id },
        data: { winners: newWinners }
    });
    
    const channel = await client.channels.fetch(dbGiveaway.channelId) as TextChannel | null;
    if (channel) {
        await channel.send(`🎉 Reroll für das Giveaway **${dbGiveaway.prize}**! Die neuen Gewinner sind: ${newWinners.map(w => `<@${w}>`).join(', ')}! Herzlichen Glückwunsch!`);
    }
    await interaction.reply({ content: `Reroll erfolgreich. Neue Gewinner: ${newWinners.map(w => `<@${w}>`).join(', ')}`, ephemeral: true });
}

const command: SlashCommand = {
  data: new SlashCommandBuilder() as SlashCommandBuilder["setName"]('geschenk')
    .setDescription('Verwaltet Geschenke/Giveaways.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand: { setName: (arg0: string) => { (): any; new(): any; setDescription: { (arg0: string): { (): any; new(): any; addStringOption: { (arg0: (option: any) => any): { (): any; new(): any; addStringOption: { (arg0: (option: any) => any): { (): any; new(): any; addIntegerOption: { (arg0: (option: any) => any): { (): any; new(): any; addChannelOption: { (arg0: (option: any) => any): any; new(): any; }; }; new(): any; }; }; new(): any; }; }; new(): any; }; }; new(): any; }; }; }) =>
        subcommand
            .setName('erstellen')
            .setDescription('Erstellt ein neues Giveaway.')
            .addStringOption(option => option.setName('preis').setDescription('Der Preis des Giveaways.').setRequired(true))
            .addStringOption(option => option.setName('dauer').setDescription('Dauer (z.B. 1h, 30m, 2d).').setRequired(true))
            .addIntegerOption(option => option.setName('gewinner').setDescription('Anzahl der Gewinner (Standard: 1).').setMinValue(1).setMaxValue(20).setRequired(false))
            .addChannelOption(option => 
                option.setName('kanal')
                .setDescription('Der Kanal, in dem das Giveaway angekündigt wird (Standard: aktueller Kanal).')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
    )
    .addSubcommand((subcommand: { setName: (arg0: string) => { (): any; new(): any; setDescription: { (arg0: string): { (): any; new(): any; addStringOption: { (arg0: (option: any) => any): any; new(): any; }; }; new(): any; }; }; }) =>
        subcommand
            .setName('beenden')
            .setDescription('Beendet ein Giveaway vorzeitig.')
            .addStringOption(option => option.setName('nachrichten_id').setDescription('Die ID der Giveaway-Nachricht.').setRequired(true))
    )
    .addSubcommand((subcommand: { setName: (arg0: string) => { (): any; new(): any; setDescription: { (arg0: string): { (): any; new(): any; addStringOption: { (arg0: (option: any) => any): any; new(): any; }; }; new(): any; }; }; }) =>
        subcommand
            .setName('neurollen')
            .setDescription('Zieht einen neuen Gewinner für ein beendetes Giveaway.')
            .addStringOption(option => option.setName('nachrichten_id').setDescription('Die ID der Giveaway-Nachricht.').setRequired(true))
    ),
  enabled: true,
  category: 'community',
  async: any execute: any(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    if (!interaction.guildId) {
        await interaction.reply({content: "Dieser Befehl ist nur auf Servern verfügbar.", ephemeral: true});
        return;
    }
    const guildSettings = await getGuildSettings(interaction.guildId, client);
    if (!guildSettings?.enableGiveaways) {
        await interaction.reply({ content: 'Giveaways sind auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'erstellen':
        await executeErstellen(interaction, client);
        break;
      case 'beenden':
        await executeBeenden(interaction, client);
        break;
      case 'neurollen':
        await executeNeurollen(interaction, client);
        break;
      default:
        await interaction.reply({ content: 'Unbekannter Unterbefehl.', ephemeral: true });
    }
  }
};

export default command;