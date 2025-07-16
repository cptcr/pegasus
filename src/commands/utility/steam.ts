import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  CommandInteraction,
  StringSelectMenuBuilder,
  ComponentType
} from 'discord.js';
import { steam } from '../../handlers/steam';
import { i18n } from '../../i18n';

export const data = new SlashCommandBuilder()
  .setName('steam')
  .setDescription('Steam game lookup and information')
  .addSubcommand(subcommand =>
    subcommand
      .setName('search')
      .setDescription('Search for a game on Steam')
      .addStringOption(option =>
        option
          .setName('query')
          .setDescription('Game name to search for')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Number of results to show (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('game')
      .setDescription('Get detailed information about a specific game')
      .addStringOption(option =>
        option
          .setName('game')
          .setDescription('Game name or Steam App ID')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('popular')
      .setDescription('Show popular games on Steam')
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Number of games to show (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('random')
      .setDescription('Get a random game from the Steam database')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('genre')
      .setDescription('Search games by genre')
      .addStringOption(option =>
        option
          .setName('genre')
          .setDescription('Genre to search for')
          .setRequired(true)
          .addChoices(
            { name: 'Action', value: 'Action' },
            { name: 'Adventure', value: 'Adventure' },
            { name: 'RPG', value: 'RPG' },
            { name: 'Strategy', value: 'Strategy' },
            { name: 'Simulation', value: 'Simulation' },
            { name: 'Sports', value: 'Sports' },
            { name: 'Racing', value: 'Racing' },
            { name: 'Indie', value: 'Indie' },
            { name: 'Casual', value: 'Casual' },
            { name: 'Horror', value: 'Horror' }
          )
      )
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Number of games to show (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
      )
  );

export async function execute(interaction: any) {
  const t = i18n.createTranslator(interaction.user.id, interaction.guildId || undefined);
  const subcommand = interaction.options.getSubcommand();

  try {
    await interaction.deferReply();

    switch (subcommand) {
      case 'search':
        await handleSearch(interaction, t);
        break;
      case 'game':
        await handleGameDetails(interaction, t);
        break;
      case 'popular':
        await handlePopular(interaction, t);
        break;
      case 'random':
        await handleRandom(interaction, t);
        break;
      case 'genre':
        await handleGenre(interaction, t);
        break;
      default:
        await interaction.editReply({
          content: t('errors.invalid_arguments')
        });
    }
  } catch (error) {
    console.error('Steam command error:', error);
    await interaction.editReply({
      content: t('errors.generic')
    });
  }
}

async function handleSearch(interaction: any, t: Function) {
  const query = interaction.options.get('query')?.value as string;
  const limit = (interaction.options.get('limit')?.value as number) || 5;

  const results = await steam.searchGames(query, limit);

  if (results.length === 0) {
    await interaction.editReply({
      content: t('steam.app_not_found')
    });
    return;
  }

  if (results.length === 1) {
    const gameDetails = await steam.getGameDetails(results[0].appid);
    if (gameDetails) {
      await sendGameEmbed(interaction, gameDetails, t);
      return;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔍 Steam Search Results for "${query}"`)
    .setColor(0x1e2328)
    .setDescription(results.map((game, index) => 
      `${index + 1}. **${game.name}** (ID: ${game.appid})`
    ).join('\n'))
    .setFooter({ text: 'Select a game to view details' });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('steam_select')
    .setPlaceholder('Select a game to view details')
    .addOptions(
      results.map(game => ({
        label: game.name.length > 100 ? game.name.substring(0, 97) + '...' : game.name,
        value: game.appid.toString(),
        description: `App ID: ${game.appid}`
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const response = await interaction.editReply({
    embeds: [embed],
    components: [row]
  });

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 60000
  });

  collector.on('collect', async (selectInteraction: any) => {
    if (selectInteraction.user.id !== interaction.user.id) {
      await selectInteraction.reply({
        content: t('errors.permission_denied'),
        ephemeral: true
      });
      return;
    }

    await selectInteraction.deferUpdate();
    
    const appId = parseInt(selectInteraction.values[0]);
    const gameDetails = await steam.getGameDetails(appId);
    
    if (gameDetails) {
      await sendGameEmbed(selectInteraction, gameDetails, t, true);
    } else {
      await selectInteraction.editReply({
        content: t('steam.app_not_found'),
        embeds: [],
        components: []
      });
    }
  });

  collector.on('end', async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch (error) {
      // Interaction might have been updated already
    }
  });
}

async function handleGameDetails(interaction: any, t: Function) {
  const gameInput = interaction.options.get('game')?.value as string;
  
  let gameDetails;
  
  // Check if input is a number (App ID)
  if (/^\d+$/.test(gameInput)) {
    gameDetails = await steam.getGameDetails(parseInt(gameInput));
  } else {
    // Search by name first
    const searchResults = await steam.searchGames(gameInput, 1);
    if (searchResults.length > 0) {
      gameDetails = await steam.getGameDetails(searchResults[0].appid);
    }
  }

  if (!gameDetails) {
    await interaction.editReply({
      content: t('steam.app_not_found')
    });
    return;
  }

  await sendGameEmbed(interaction, gameDetails, t);
}

async function handlePopular(interaction: any, t: Function) {
  const limit = (interaction.options.get('limit')?.value as number) || 5;
  
  const popularGames = await steam.getPopularGames(limit);

  if (popularGames.length === 0) {
    await interaction.editReply({
      content: 'No popular games found in cache. Try searching for some games first!'
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🔥 Popular Steam Games')
    .setColor(0x1e2328)
    .setDescription(
      popularGames.map((game, index) => 
        `${index + 1}. **${game.name}**\n` +
        `   ${steam.formatPrice(game.price_overview)} | ${steam.getPlatformEmojis(game.platforms)}\n` +
        (game.recommendations ? `   👍 ${game.recommendations.total.toLocaleString()} recommendations\n` : '')
      ).join('\n')
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleRandom(interaction: any, t: Function) {
  const randomGame = await steam.getRandomGame();

  if (!randomGame) {
    await interaction.editReply({
      content: 'No games found in cache. Try searching for some games first!'
    });
    return;
  }

  await sendGameEmbed(interaction, randomGame, t);
}

async function handleGenre(interaction: any, t: Function) {
  const genre = interaction.options.get('genre')?.value as string;
  const limit = (interaction.options.get('limit')?.value as number) || 5;

  const games = await steam.searchByGenre(genre, limit);

  if (games.length === 0) {
    await interaction.editReply({
      content: `No ${genre} games found in cache. Try searching for some games first!`
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎮 ${genre} Games`)
    .setColor(0x1e2328)
    .setDescription(
      games.map((game, index) => 
        `${index + 1}. **${game.name}**\n` +
        `   ${steam.formatPrice(game.price_overview)} | ${steam.getPlatformEmojis(game.platforms)}`
      ).join('\n\n')
    );

  await interaction.editReply({ embeds: [embed] });
}

async function sendGameEmbed(
  interaction: CommandInteraction | any, 
  game: any, 
  t: Function, 
  isUpdate: boolean = false
) {
  const embed = new EmbedBuilder()
    .setTitle(game.name)
    .setColor(0x1e2328)
    .setDescription(game.short_description || 'No description available')
    .setImage(game.header_image)
    .addFields(
      {
        name: t('steam.price'),
        value: steam.formatPrice(game.price_overview),
        inline: true
      },
      {
        name: t('steam.release_date'),
        value: game.release_date.coming_soon ? 
          `${t('steam.coming_soon')}: ${game.release_date.date}` : 
          game.release_date.date,
        inline: true
      },
      {
        name: t('steam.platforms'),
        value: steam.getPlatformEmojis(game.platforms),
        inline: true
      }
    );

  if (game.developers && game.developers.length > 0) {
    embed.addFields({
      name: t('steam.developer'),
      value: game.developers.slice(0, 3).join(', '),
      inline: true
    });
  }

  if (game.publishers && game.publishers.length > 0) {
    embed.addFields({
      name: t('steam.publisher'),
      value: game.publishers.slice(0, 3).join(', '),
      inline: true
    });
  }

  if (game.genres && game.genres.length > 0) {
    embed.addFields({
      name: t('steam.genres'),
      value: game.genres.slice(0, 5).map((g: any) => g.description).join(', '),
      inline: true
    });
  }

  if (game.reviews) {
    embed.addFields({
      name: t('steam.reviews'),
      value: steam.getReviewScore(game.reviews),
      inline: true
    });
  }

  if (game.recommendations) {
    embed.addFields({
      name: '👍 Recommendations',
      value: game.recommendations.total.toLocaleString(),
      inline: true
    });
  }

  if (game.metacritic) {
    embed.addFields({
      name: 'Metacritic Score',
      value: `${game.metacritic.score}/100`,
      inline: true
    });
  }

  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setLabel('View on Steam')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://store.steampowered.com/app/${game.appid}`)
    );

  if (game.website) {
    buttons.addComponents(
      new ButtonBuilder()
        .setLabel('Official Website')
        .setStyle(ButtonStyle.Link)
        .setURL(game.website)
    );
  }

  embed.setFooter({ 
    text: `Steam App ID: ${game.appid} | Type: ${game.type}` 
  });

  const payload = {
    embeds: [embed],
    components: [buttons]
  };

  if (isUpdate) {
    await interaction.editReply(payload);
  } else {
    await interaction.editReply(payload);
  }
}