import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  CommandInteraction, 
  PermissionFlagsBits 
} from 'discord.js';
import { i18n } from '../../i18n';

export const data = new SlashCommandBuilder()
  .setName('language')
  .setDescription('Manage language preferences')
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Set your personal language preference')
      .addStringOption(option =>
        option
          .setName('language')
          .setDescription('Language to use')
          .setRequired(true)
          .addChoices(
            { name: 'English', value: 'en' },
            { name: 'Español', value: 'es' },
            { name: 'Français', value: 'fr' },
            { name: 'Deutsch', value: 'de' },
            { name: 'Italiano', value: 'it' },
            { name: 'Português', value: 'pt' },
            { name: 'Русский', value: 'ru' },
            { name: '日本語', value: 'ja' },
            { name: '한국어', value: 'ko' },
            { name: '中文', value: 'zh' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('server')
      .setDescription('Set the server default language (Admin only)')
      .addStringOption(option =>
        option
          .setName('language')
          .setDescription('Language to use as server default')
          .setRequired(true)
          .addChoices(
            { name: 'English', value: 'en' },
            { name: 'Español', value: 'es' },
            { name: 'Français', value: 'fr' },
            { name: 'Deutsch', value: 'de' },
            { name: 'Italiano', value: 'it' },
            { name: 'Português', value: 'pt' },
            { name: 'Русский', value: 'ru' },
            { name: '日本語', value: 'ja' },
            { name: '한국어', value: 'ko' },
            { name: '中文', value: 'zh' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('current')
      .setDescription('Show your current language preferences')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reset')
      .setDescription('Reset your personal language to server default')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('available')
      .setDescription('List all available languages')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('stats')
      .setDescription('Show translation statistics (Admin only)')
  );

export async function execute(interaction: any) {
  const subcommand = interaction.options?.getSubcommand();
  
  // Get current translator before any language changes
  const t = i18n.createTranslator(interaction.user.id, interaction.guildId || undefined);

  try {
    switch (subcommand) {
      case 'set':
        await handleSetUserLanguage(interaction, t);
        break;
      case 'server':
        await handleSetServerLanguage(interaction, t);
        break;
      case 'current':
        await handleShowCurrent(interaction, t);
        break;
      case 'reset':
        await handleResetUserLanguage(interaction, t);
        break;
      case 'available':
        await handleShowAvailable(interaction, t);
        break;
      case 'stats':
        await handleShowStats(interaction, t);
        break;
      default:
        await interaction.reply({
          content: t('errors.invalid_arguments'),
          ephemeral: true
        });
    }
  } catch (error) {
    console.error('Language command error:', error);
    await interaction.reply({
      content: t('errors.generic'),
      ephemeral: true
    });
  }
}

async function handleSetUserLanguage(interaction: any, t: Function) {
  const language = interaction.options?.get('language')?.value as string;
  
  const success = await i18n.setUserLanguage(interaction.user.id, language);
  
  if (success) {
    // Get new translator with updated language
    const newT = i18n.createTranslator(interaction.user.id, interaction.guildId || undefined);
    const languageName = i18n.getLocaleName(language);
    
    await interaction.reply({
      content: newT('language.set_user', { variables: { language: languageName } }),
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: t('language.invalid', { 
        variables: { languages: i18n.getSupportedLocales().join(', ') }
      }),
      ephemeral: true
    });
  }
}

async function handleSetServerLanguage(interaction: any, t: Function) {
  if (!interaction.guild) {
    await interaction.reply({
      content: t('errors.guild_only'),
      ephemeral: true
    });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: t('errors.permission_denied'),
      ephemeral: true
    });
    return;
  }

  const language = interaction.options?.get('language')?.value as string;
  
  const success = await i18n.setGuildLanguage(interaction.guild.id, language);
  
  if (success) {
    const languageName = i18n.getLocaleName(language);
    
    await interaction.reply({
      content: t('language.set_guild', { variables: { language: languageName } }),
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: t('language.invalid', { 
        variables: { languages: i18n.getSupportedLocales().join(', ') }
      }),
      ephemeral: true
    });
  }
}

async function handleShowCurrent(interaction: any, t: Function) {
  const userLanguage = i18n.getUserLanguage(interaction.user.id);
  const guildLanguage = interaction.guildId ? i18n.getGuildLanguage(interaction.guildId) : 'en';
  const effectiveLanguage = i18n.getLocale(interaction.user.id, interaction.guildId || undefined);

  const embed = new EmbedBuilder()
    .setTitle('🌐 Language Preferences')
    .setColor(0x0099ff)
    .addFields(
      {
        name: 'Your Personal Language',
        value: userLanguage ? i18n.getLocaleName(userLanguage) : 'Not set (using server default)',
        inline: true
      },
      {
        name: 'Server Default',
        value: i18n.getLocaleName(guildLanguage),
        inline: true
      },
      {
        name: 'Currently Using',
        value: i18n.getLocaleName(effectiveLanguage),
        inline: true
      }
    )
    .setFooter({
      text: 'Personal language overrides server default. Use /language reset to use server default.'
    });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

async function handleResetUserLanguage(interaction: any, t: Function) {
  const success = await i18n.resetUserLanguage(interaction.user.id);
  
  if (success) {
    await interaction.reply({
      content: t('language.reset_user'),
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: t('errors.generic'),
      ephemeral: true
    });
  }
}

async function handleShowAvailable(interaction: any, t: Function) {
  const availableLanguages = i18n.getAvailableLanguages();
  
  const embed = new EmbedBuilder()
    .setTitle(t('language.available'))
    .setColor(0x0099ff)
    .setDescription(
      availableLanguages.map(lang => 
        `**${lang.name}** (\`${lang.code}\`)`
      ).join('\n')
    )
    .setFooter({
      text: 'Use /language set <code> to change your language'
    });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

async function handleShowStats(interaction: any, t: Function) {
  if (!interaction.guild) {
    await interaction.reply({
      content: t('errors.guild_only'),
      ephemeral: true
    });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: t('errors.permission_denied'),
      ephemeral: true
    });
    return;
  }

  const stats = i18n.getTranslationStats();
  
  const embed = new EmbedBuilder()
    .setTitle('📊 Translation Statistics')
    .setColor(0x0099ff);

  const loadedLanguages = Object.entries(stats)
    .filter(([_, data]: [string, any]) => data.loaded)
    .map(([code, data]: [string, any]) => 
      `**${data.name}** (\`${code}\`): ${data.keyCount} translations`
    );

  const notLoadedLanguages = Object.entries(stats)
    .filter(([_, data]: [string, any]) => !data.loaded)
    .map(([code, data]: [string, any]) => 
      `**${data.name}** (\`${code}\`): Not loaded`
    );

  if (loadedLanguages.length > 0) {
    embed.addFields({
      name: '✅ Loaded Languages',
      value: loadedLanguages.join('\n'),
      inline: false
    });
  }

  if (notLoadedLanguages.length > 0) {
    embed.addFields({
      name: '❌ Not Loaded',
      value: notLoadedLanguages.join('\n'),
      inline: false
    });
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}