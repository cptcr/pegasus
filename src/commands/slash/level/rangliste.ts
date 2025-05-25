import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand, ClientWithCommands } from '../../../types';
import { getGuildSettings } from '../../../utils/guildSettings';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('rangliste')
    .setDescription('Zeigt die Top-Benutzer des Servers nach Level und XP an.')
    .addIntegerOption(option =>
        option.setName('seite')
            .setDescription('Die Seite der Rangliste, die angezeigt werden soll (Standard: 1).')
            .setMinValue(1)
            .setRequired(false)),
  enabled: true,
  category: 'level',
  async execute(interaction: ChatInputCommandInteraction, client: ClientWithCommands) {
    if (!interaction.guildId) {
        await interaction.reply({ content: 'Dieser Befehl kann nur auf einem Server verwendet werden.', ephemeral: true });
        return;
    }
    const guildSettings = await getGuildSettings(interaction.guildId, client);
    if (!guildSettings?.enableLeveling) {
        await interaction.reply({ content: 'Das Levelsystem ist auf diesem Server deaktiviert.', ephemeral: true });
        return;
    }

    const page = interaction.options.getInteger('seite') || 1;
    const entriesPerPage = 10;
    const skip = (page - 1) * entriesPerPage;

    const leaderboardEntries = await client.prisma.userLevel.findMany({
        where: { guildId: interaction.guildId },
        orderBy: [
            { level: 'desc' },
            { xp: 'desc' },
        ],
        skip: skip,
        take: entriesPerPage,
        include: {
            user: {
                select: { username: true }
            }
        }
    });

    if (leaderboardEntries.length === 0) {
        await interaction.reply({ content: 'Es gibt noch keine Einträge in der Rangliste für diesen Server.', ephemeral: true });
        return;
    }

    const totalEntries = await client.prisma.userLevel.count({ where: { guildId: interaction.guildId } });
    const totalPages = Math.ceil(totalEntries / entriesPerPage);

    if (page > totalPages && totalPages > 0) {
        await interaction.reply({ content: `Diese Seite existiert nicht. Es gibt nur ${totalPages} Seiten.`, ephemeral: true });
        return;
    }


    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Rangliste für ${interaction.guild?.name} - Seite <span class="math-inline">\{page\}/</span>{totalPages}`)
        .setTimestamp();

    let description = '';
    leaderboardEntries.forEach((entry, index) => {
        const rank = skip + index + 1;
        description += `**#${rank}.** <span class="math-inline">\{entry\.user\.username\} \- Level \*\*</span>{entry.level}** (${entry.xp.toLocaleString()} XP)\n`;
    });

    embed.setDescription(description.trim());
    embed.setFooter({text: `Gesamtzahl der Spieler: ${totalEntries}`});


    await interaction.reply({ embeds: [embed] });
  }
};

export default command;