import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    OverwriteType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    TextChannel,
    CategoryChannel
} from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';
import { getGuildSettings } from '../../../utils/guildSettings';

async function logTicketAction(client: ClientWithCommands, guildId: string, title: string, user: User, ticketChannel: TextChannel, moderator?: User, reason?: string, fields?: {name: string, value: string}[]) {
    const settings = await getGuildSettings(guildId, client);
    if (settings?.modLogChannelId) {
        const logChannel = await client.channels.fetch(settings.modLogChannelId).catch(() => null) as TextChannel | null;
        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor(0x00BFFF)
                .setTitle(title)
                .setDescription(`Ticket: ${ticketChannel.toString()} (${ticketChannel.name})`)
                .addFields(
                    { name: 'Benutzer', value: `${user.tag} (${user.id})`, inline: true },
                    ...(moderator ? [{ name: 'Bearbeiter', value: `${moderator.tag} (${moderator.id})`, inline: true }] : []),
                    ...(reason ? [{ name: 'Grund/Details', value: reason, inline: false }] : []),
                    ...(fields || [])
                )
                .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(console.error);
        }
    }
}


const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Verwaltet das Ticketsystem.')
    .addSubcommand(subcommand =>
        subcommand
            .setName('erstellen')
            .setDescription('Erstellt ein neues Support-Ticket.')
            .addStringOption(option => option.setName('thema').setDescription('Das Thema deines Anliegens.').setRequired(true))
            .addStringOption(option => option.setName('details').setDescription('Weitere Details zu deinem Anliegen (optional).').setRequired(false))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('schliessen')
            .setDescription('Schließt ein Ticket (nur für Moderatoren oder Ticketersteller im eigenen Ticket).')
            .addStringOption(option => 
                option.setName('grund')
                .setDescription('Grund für das Schließen (optional).')
                .setRequired(false))
    )
     .addSubcommand(subcommand =>
        subcommand
            .setName('setup')
            .setDescription('Richtet das Ticketsystem ein oder zeigt die aktuelle Konfiguration (Admin).')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addChannelOption(option => 
                option.setName('kategorie')
                .setDescription('Die Kategorie, in der Tickets erstellt werden sollen.')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(false))
            .addRoleOption(option =>
                option.setName('support-rolle')
                .setDescription('Die Rolle, die Zugriff auf Tickets erhält.')
                .setRequired(false))
            .addChannelOption(option =>
                option.setName('log-kanal')
                .setDescription('Kanal für Ticket-Logs.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
    ),
  enabled: true,
  category: 'community',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    if (!interaction.guild || !interaction.guildId) {
        await interaction.reply({ content: 'Dieser Befehl kann nur auf einem Server verwendet werden.', ephemeral: true });
        return;
    }
    const guildSettings = await getGuildSettings(interaction.guildId, client);
    if (!guildSettings?.enableTickets) {
        await interaction.reply({ content: 'Das Ticketsystem ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'erstellen') {
        const subject = interaction.options.getString('thema', true);
        const details = interaction.options.getString('details');
        const user = interaction.user;

        const existingTicket = await client.prisma.ticket.findFirst({
            where: {
                guildId: interaction.guildId,
                userId: user.id,
                status: 'OPEN',
            }
        });

        if (existingTicket) {
            await interaction.reply({ content: 'Du hast bereits ein offenes Ticket. Bitte warte, bis es bearbeitet wurde, oder schließe es, bevor du ein neues erstellst.', ephemeral: true});
            return;
        }
        
        let ticketCategory = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('tickets') || c.name.toLowerCase().includes('support')) as CategoryChannel | undefined;
        
        if (guildSettings.ticketCategoryId) {
             ticketCategory = interaction.guild.channels.cache.get(guildSettings.ticketCategoryId) as CategoryChannel | undefined;
        }
        if (!ticketCategory) {
             ticketCategory = await interaction.guild.channels.create({
                name: 'Support Tickets',
                type: ChannelType.GuildCategory,
             }).catch(() => undefined);
        }

        if(!ticketCategory) {
            await interaction.reply({ content: 'Konnte keine Ticket-Kategorie finden oder erstellen. Bitte konfiguriere eine oder erstelle eine Kategorie namens "Support Tickets".', ephemeral: true});
            return;
        }
        
        const ticketNumber = (await client.prisma.ticket.count({ where: { guildId: interaction.guildId } })) + 1;
        const channelName = `ticket-${ticketNumber}-${user.username.substring(0, 10)}`.toLowerCase();

        try {
            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: ticketCategory.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.EmbedLinks],
                    },
                    ...(guildSettings.ticketSupportRoleId ? [{
                        id: guildSettings.ticketSupportRoleId,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.EmbedLinks],
                    }] : []),
                     ...interaction.guild.roles.cache
                            .filter(role => role.permissions.has(PermissionsBitField.Flags.Administrator))
                            .map(role => ({ id: role.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.EmbedLinks] }))
                ],
            });

            const newTicket = await client.prisma.ticket.create({
                data: {
                    guildId: interaction.guildId,
                    channelId: ticketChannel.id,
                    userId: user.id,
                    subject: subject,
                    category: 'Allgemein', // TODO: Kategorien hinzufügen
                    status: 'OPEN',
                    priority: 'MEDIUM' // TODO: Priorität hinzufügen
                }
            });

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`Neues Ticket: ${subject}`)
                .setDescription(`Willkommen im Support, ${user.toString()}! Bitte beschreibe dein Anliegen so detailliert wie möglich. Ein Teammitglied wird sich bald bei dir melden.\n\n**Details:**\n${details || 'Keine weiteren Details angegeben.'}`)
                .addFields({name: "Ticket ID", value: newTicket.id.toString(), inline: true})
                .setTimestamp()
                .setFooter({ text: `Ticket erstellt von ${user.tag}`});

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`close_ticket_${newTicket.id}`)
                        .setLabel('Ticket Schließen')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

            await ticketChannel.send({ content: `${user.toString()} ${guildSettings.ticketSupportRoleId ? `<@&${guildSettings.ticketSupportRoleId}>` : ''}`, embeds: [embed], components: [row] });
            await interaction.reply({ content: `Dein Ticket wurde erfolgreich in ${ticketChannel.toString()} erstellt!`, ephemeral: true });

            logTicketAction(client, interaction.guildId, 'Neues Ticket Erstellt', user, ticketChannel, undefined, subject);


        } catch (error) {
            console.error("Fehler beim Erstellen des Ticket-Kanals:", error);
            await interaction.reply({ content: 'Es gab einen Fehler beim Erstellen deines Tickets. Bitte versuche es später erneut oder kontaktiere einen Administrator.', ephemeral: true });
        }


    } else if (subcommand === 'schliessen') {
        if (!interaction.channel || !(interaction.channel instanceof TextChannel) || !interaction.channel.name.startsWith('ticket-')) {
             await interaction.reply({ content: 'Dieser Befehl kann nur in einem Ticket-Kanal verwendet werden.', ephemeral: true });
            return;
        }

        const ticketRecord = await client.prisma.ticket.findFirst({
            where: { channelId: interaction.channelId, guildId: interaction.guildId }
        });

        if (!ticketRecord) {
            await interaction.reply({ content: 'Konnte die Ticketdaten nicht finden. Dieser Kanal ist möglicherweise kein gültiger Ticket-Kanal.', ephemeral: true });
            return;
        }
         if (ticketRecord.status === 'CLOSED') {
            await interaction.reply({ content: 'Dieses Ticket ist bereits geschlossen.', ephemeral: true });
            return;
        }

        const member = interaction.member as GuildMember;
        const canClose = member.permissions.has(PermissionsBitField.Flags.ManageChannels) || ticketRecord.userId === interaction.user.id;

        if (!canClose) {
            await interaction.reply({ content: 'Du bist nicht berechtigt, dieses Ticket zu schließen.', ephemeral: true });
            return;
        }
        
        const reason = interaction.options.getString('grund');

        const modal = new ModalBuilder()
            .setCustomId(`close_ticket_modal_${ticketRecord.id}`)
            .setTitle('Ticket Schließen Bestätigen');

        const reasonInput = new TextInputBuilder()
            .setCustomId('close_reason')
            .setLabel("Grund für das Schließen (optional)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setValue(reason || '');
        
        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);


    } else if (subcommand === 'setup') {
        const category = interaction.options.getChannel('kategorie') as CategoryChannel | null;
        const supportRole = interaction.options.getRole('support-rolle') as Role | null;
        const logChannel = interaction.options.getChannel('log-kanal') as TextChannel | null;

        let updateData: Partial<GuildSettings> = {};
        let messages: string[] = [];

        if (category) {
            updateData.ticketCategoryId = category.id;
            messages.push(`Ticket-Kategorie auf ${category.name} gesetzt.`);
        }
        if (supportRole) {
            updateData.ticketSupportRoleId = supportRole.id;
            messages.push(`Support-Rolle auf ${supportRole.name} gesetzt.`);
        }
        if (logChannel) {
            updateData.modLogChannelId = logChannel.id; // Using modLogChannel for ticket logs as well for now
            messages.push(`Ticket-Log-Kanal auf ${logChannel.name} gesetzt.`);
        }
        
        if (Object.keys(updateData).length > 0) {
            await client.prisma.guild.update({
                where: {id: interaction.guildId},
                data: updateData
            });
            await interaction.reply({ content: `Ticket-System Einstellungen aktualisiert:\n- ${messages.join('\n- ')}`, ephemeral: true});
        } else {
            const currentSettings = await getGuildSettings(interaction.guildId, client);
            const cat = currentSettings.ticketCategoryId ? interaction.guild.channels.cache.get(currentSettings.ticketCategoryId)?.name : 'Nicht gesetzt';
            const role = currentSettings.ticketSupportRoleId ? interaction.guild.roles.cache.get(currentSettings.ticketSupportRoleId)?.name : 'Nicht gesetzt';
            const log = currentSettings.modLogChannelId ? interaction.guild.channels.cache.get(currentSettings.modLogChannelId)?.name : 'Nicht gesetzt';

             const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('Aktuelle Ticket-System Einstellungen')
                .addFields(
                    {name: 'Ticket Kategorie', value: cat || 'Nicht gesetzt'},
                    {name: 'Support Rolle', value: role || 'Nicht gesetzt'},
                    {name: 'Log Kanal', value: log || 'Nicht gesetzt (nutzt Mod-Log Kanal wenn vorhanden)'}
                )
                .setFooter({text: 'Nutze die Optionen dieses Befehls, um Einstellungen zu ändern.'});
            await interaction.reply({embeds: [embed], ephemeral: true});
        }
    }
  }
};

export default command;