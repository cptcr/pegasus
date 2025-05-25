import { ClientWithCommands, Feature } from '../../types';
import { Events, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Interaction, PermissionsBitField, OverwriteResolvable, ChannelType, GuildMember, User } from 'discord.js';
import { getGuildSettings } from '../../utils/guildSettings';

const TICKET_CATEGORY_NAME_PREFIX = "Support Tickets";
const TICKET_LOG_ACTION_COLOR = 0x00BFFF;

async function logTicketAction(client: ClientWithCommands, guildId: string, title: string, user: User, ticketChannel: TextChannel, moderator?: User, reason?: string, fields?: {name: string, value: string}[]) {
    const settings = await getGuildSettings(guildId, client);
    if (settings?.modLogChannelId) {
        const logChannel = await client.channels.fetch(settings.modLogChannelId).catch(() => null) as TextChannel | null;
        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor(TICKET_LOG_ACTION_COLOR)
                .setTitle(title)
                .setDescription(`Ticket: <span class="math-inline">\{ticketChannel\.toString\(\)\} \(</span>{ticketChannel.name})`)
                .addFields(
                    { name: 'Benutzer', value: `<span class="math-inline">\{user\.tag\} \(</span>{user.id})`, inline: true },
                    ...(moderator ? [{ name: 'Bearbeiter', value: `<span class="math-inline">\{moderator\.tag\} \(</span>{moderator.id})`, inline: true }] : []),
                    ...(reason ? [{ name: 'Grund/Details', value: reason, inline: false }] : []),
                    ...(fields || [])
                )
                .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(console.error);
        }
    }
}

const ticketsFeature: Feature = {
  name: 'tickets',
  description: 'Verwaltet das Support-Ticketsystem.',
  enabled: true,
  async initialize(client: ClientWithCommands) {
    if (!client.config.enabledFeatures.tickets) {
      return;
    }

    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      if (!interaction.isButton() || !interaction.guild || !interaction.guildId) return;

      const guildSettings = await getGuildSettings(interaction.guildId, client);
      if (!guildSettings?.enableTickets) return;

      if (interaction.customId.startsWith('close_ticket_')) {
        const ticketIdString = interaction.customId.split('_')[2];
        const ticketId = parseInt(ticketIdString);

        if (isNaN(ticketId)) {
            await interaction.reply({ content: 'Ungültige Ticket-ID.', ephemeral: true });
            return;
        }

        const ticketRecord = await client.prisma.ticket.findUnique({
            where: { id: ticketId, guildId: interaction.guildId }
        });

        if (!ticketRecord) {
            await interaction.reply({ content: 'Ticket nicht in der Datenbank gefunden.', ephemeral: true });
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

        const ticketChannel = interaction.guild.channels.cache.get(ticketRecord.channelId) as TextChannel | undefined;

        if (!ticketChannel) {
            await interaction.reply({ content: 'Der Kanal für dieses Ticket konnte nicht gefunden werden. Möglicherweise wurde er manuell gelöscht.', ephemeral: true });
             await client.prisma.ticket.update({
                where: { id: ticketId },
                data: { status: 'CLOSED', closedAt: new Date(), moderatorId: interaction.user.id },
            });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(`close_ticket_modal_${ticketId}`)
            .setTitle('Ticket Schließen Bestätigen');

        const reasonInput = new TextInputBuilder()
            .setCustomId('close_reason')
            .setLabel("Grund für das Schließen (optional)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);

      } else if (interaction.customId.startsWith('reopen_ticket_')) {
          const ticketIdString = interaction.customId.split('_')[2];
          const ticketId = parseInt(ticketIdString);
          if (isNaN(ticketId)) return;

          const ticketRecord = await client.prisma.ticket.findUnique({ where: {id: ticketId, guildId: interaction.guildId }});
          if (!ticketRecord || !ticketRecord.closedAt) {
              await interaction.reply({content: 'Ticket nicht gefunden oder nicht geschlossen.', ephemeral: true});
              return;
          }

          const member = interaction.member as GuildMember;
          if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
              await interaction.reply({content: 'Du hast keine Berechtigung, dieses Ticket wieder zu öffnen.', ephemeral: true});
              return;
          }

          const ticketChannel = interaction.guild.channels.cache.get(ticketRecord.channelId) as TextChannel | undefined;
          if (!ticketChannel) {
            await interaction.reply({content: 'Ticket-Kanal nicht gefunden.', ephemeral: true});
            return;
          }

          await client.prisma.ticket.update({
              where: { id: ticketId },
              data: { status: 'OPEN', closedAt: null, moderatorId: null }
          });

          await ticketChannel.permissionOverwrites.edit(ticketRecord.userId, { ViewChannel: true, SendMessages: true });
          await ticketChannel.setName(ticketChannel.name.replace('geschlossen-', `ticket-${ticketRecord.id}-`));

          const reopenEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('Ticket Wiedereröffnet')
            .setDescription(`Dieses Ticket wurde von ${interaction.user.tag} wiedereröffnet.`)
            .setTimestamp();
          await ticketChannel.send({embeds: [reopenEmbed]});

          const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`close_ticket_${ticketId}`)
                        .setLabel('Ticket Schließen')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );
          await interaction.message?.edit({ components: [row]});
          await interaction.reply({content: 'Ticket wurde wiedereröffnet.', ephemeral: true});

           logTicketAction(client, interaction.guildId, 'Ticket Wiedereröffnet', interaction.user, ticketChannel, interaction.user);
      }
    });

    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        if (!interaction.isModalSubmit() || !interaction.guild || !interaction.guildId) return;

        if (interaction.customId.startsWith('close_ticket_modal_')) {
            const ticketIdString = interaction.customId.split('_')[3];
            const ticketId = parseInt(ticketIdString);
             if (isNaN(ticketId)) {
                await interaction.reply({ content: 'Ungültige Ticket-ID im Modal.', ephemeral: true });
                return;
            }

            const reason = interaction.fields.getTextInputValue('close_reason') || 'Kein Grund angegeben.';
            const ticketRecord = await client.prisma.ticket.findUnique({ where: { id: ticketId, guildId: interaction.guildId }});

            if (!ticketRecord) {
                await interaction.reply({ content: 'Ticket nicht gefunden.', ephemeral: true });
                return;
            }

            const ticketChannel = interaction.guild.channels.cache.get(ticketRecord.channelId) as TextChannel | undefined;
             if (!ticketChannel) {
                await interaction.reply({ content: 'Der Kanal für dieses Ticket konnte nicht gefunden werden. Es wird in der Datenbank als geschlossen markiert.', ephemeral: true });
                await client.prisma.ticket.update({
                    where: { id: ticketId },
                    data: { status: 'CLOSED', closedAt: new Date(), moderatorId: interaction.user.id, closeReason: reason },
                });
                return;
            }

            await client.prisma.ticket.update({
                where: { id: ticketId },
                data: { status: 'CLOSED', closedAt: new Date(), moderatorId: interaction.user.id, closeReason: reason },
            });

            await interaction.reply({ content: 'Ticket wird geschlossen...', ephemeral: true });

            const closeEmbed = new EmbedBuilder()
                .setColor(0xDD2E44)
                .setTitle('Ticket Geschlossen')
                .setDescription(`Dieses Ticket wurde von ${interaction.user.tag} geschlossen.`)
                .addFields({ name: 'Grund', value: reason})
                .setTimestamp();

            await ticketChannel.send({ embeds: [closeEmbed] });

            setTimeout(async () => {
                 try {
                    await ticketChannel.setName(`geschlossen-${ticketChannel.name.replace(/^ticket-\d+-/, '')}`.substring(0,100));
                    const overwrites: OverwriteResolvable[] = [
                        {
                            id: interaction.guild!.roles.everyone,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: ticketRecord.userId,
                            allow: [PermissionsBitField.Flags.ViewChannel],
                            deny: [PermissionsBitField.Flags.SendMessages],
                        },
                        ...interaction.guild!.roles.cache
                            .filter(role => role.permissions.has(PermissionsBitField.Flags.Administrator))
                            .map(role => ({ id: role.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                    ];
                     await ticketChannel.permissionOverwrites.set(overwrites);

                    const row = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`reopen_ticket_${ticketId}`)
                                .setLabel('Ticket Wiedereröffnen (Admin)')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji('🔓')
                        );
                    await ticketChannel.send({content: "Moderatoren können dieses Ticket bei Bedarf wieder öffnen.", components: [row]});

                } catch (channelError) {
                    console.error("Fehler beim Ändern des Ticket-Kanals:", channelError);
                }
            }, 3000);

            logTicketAction(client, interaction.guildId, 'Ticket Geschlossen', interaction.user, ticketChannel, interaction.user, reason);
        }
    });
  },
};

export default ticketsFeature;