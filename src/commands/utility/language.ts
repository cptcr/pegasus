import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t, setUserLocale, getUserLocale, availableLocales } from '../../i18n';
import { getDatabase } from '../../database/connection';
import { users } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { ensureUserExists } from '../../utils/userUtils';

export const data = new SlashCommandBuilder()
  .setName('language')
  .setDescription(t('commands.language.description'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('available')
      .setDescription(t('commands.language.subcommands.available.description'))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('current')
      .setDescription(t('commands.language.subcommands.current.description'))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription(t('commands.language.subcommands.set.description'))
      .addStringOption(option =>
        option
          .setName('language')
          .setDescription(t('commands.language.subcommands.set.options.language'))
          .setRequired(true)
          .addChoices(
            { name: 'English', value: 'en' },
            { name: 'Deutsch', value: 'de' },
            { name: 'Español', value: 'es' },
            { name: 'Français', value: 'fr' }
          )
      )
  );

export const category = CommandCategory.Utility;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'available':
      return handleAvailable(interaction);
    case 'current':
      return handleCurrent(interaction);
    case 'set':
      return handleSet(interaction);
  }
}

async function handleAvailable(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(t('commands.language.subcommands.available.title'))
    .setDescription(t('commands.language.subcommands.available.description'))
    .addFields(
      {
        name: '🇬🇧 English',
        value: 'Default language',
        inline: true,
      },
      {
        name: '🇩🇪 Deutsch',
        value: 'German language',
        inline: true,
      },
      {
        name: '🇪🇸 Español',
        value: 'Spanish language',
        inline: true,
      },
      {
        name: '🇫🇷 Français',
        value: 'French language',
        inline: true,
      }
    )
    .setFooter({
      text: t('commands.language.subcommands.available.footer'),
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleCurrent(interaction: ChatInputCommandInteraction) {
  const currentLocale = getUserLocale(interaction.user.id);
  const languageNames: Record<string, string> = {
    en: 'English',
    de: 'Deutsch',
    es: 'Español',
    fr: 'Français',
  };

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(t('commands.language.subcommands.current.title'))
    .setDescription(
      t('commands.language.subcommands.current.description', {
        language: languageNames[currentLocale] || currentLocale,
        code: currentLocale,
      })
    )
    .setFooter({
      text: t('commands.language.subcommands.current.footer'),
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleSet(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const newLocale = interaction.options.getString('language', true);

  if (!availableLocales.includes(newLocale)) {
    return interaction.editReply({
      content: t('commands.language.subcommands.set.invalidLanguage'),
    });
  }

  try {
    // Update user locale in memory
    setUserLocale(interaction.user.id, newLocale);

    // Ensure user exists in database first
    await ensureUserExists(interaction.user);
    
    // Update user locale in database
    const db = getDatabase();
    await db
      .update(users)
      .set({ 
        preferredLocale: newLocale,
        updatedAt: new Date(),
      })
      .where(eq(users.id, interaction.user.id));

    const languageNames: Record<string, string> = {
      en: 'English',
      de: 'Deutsch',
      es: 'Español',
      fr: 'Français',
    };

    // Reply in the new language
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(t('commands.language.subcommands.set.success.title', {}))
      .setDescription(
        t('commands.language.subcommands.set.success.description', {
          language: languageNames[newLocale],
        })
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error setting user language:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
  return;
}
