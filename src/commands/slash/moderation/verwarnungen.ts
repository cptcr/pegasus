import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';
import { getGuildSettings } from '../../../utils/guildSettings';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('verwarnungen')
    .setDescription('Zeigt die Verwarnungen eines Benutzers oder alle aktiven Verwarnungen an.')
    .addUserOption(option =>
      option.setName('benutzer')
        .setDescription('Der Benutzer, dessen Verwarnungen angezeigt werden sollen.')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  enabled: true,
  category: 'moderation',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    if (!interaction.guildId) {
        await interaction.reply({ content: 'Dieser Befehl kann nur auf einem Server verwendet werden.', ephemeral: true });
        return;
    }
    const guildSettings = await getGuildSettings(interaction.guildId, client);
    if (!guildSettings?.enableModeration) {
        await interaction.reply({ content: 'Das Moderationssystem ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }

    const targetUser = interaction.options.getUser('benutzer');

    try {
      const whereClause: { guildId: string; userId?: string; active?: boolean } = { guildId: interaction.guildId, active: true };
      if (targetUser) {
        whereClause.userId = targetUser.id;
      }

      const warnings = await client.prisma.warn.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: targetUser ? 25 : 10,
        include: {
          user: { select: { username: true } },
          moderator: { select: { username: true } }
        }
      });

      if (warnings.length === 0) {
        await interaction.reply({ content: targetUser ? `Keine aktiven Verwarnungen für ${targetUser.tag} gefunden.` : 'Keine aktiven Verwarnungen auf diesem Server.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(targetUser ? `Aktive Verwarnungen für ${targetUser.tag}` : 'Aktive Server Verwarnungen')
        .setTimestamp();

      warnings.forEach(warn => {
        embed.addFields({
          name: `Verwarnung #${warn.id} (Benutzer: ${warn.user.username})`,
          value: `**Grund:** ${warn.reason}\n**Moderator:** <span class="math-inline">\{warn\.moderator\.username\}\\n\*\*Datum\:\*\* <t\:</span>{Math.floor(new Date(warn.createdAt).getTime() / 1000)}:R>`,
          inline: false
        });
      });

      if (warnings.length >= (targetUser ? 25 : 10)) {
        embed.setFooter({ text: `Zeige die letzten ${targetUser ? 25 : 10} Verwarnungen.` });
      }

      await interaction.reply({ embeds: [embed], ephemeral: !targetUser });

    } catch (error) {
      console.error('Fehler beim Abrufen der Verwarnungen:', error);
      await interaction.reply({ content: 'Ein Fehler ist beim Abrufen der Verwarnungen aufgetreten.', ephemeral: true });
    }
  }
};

export default command;