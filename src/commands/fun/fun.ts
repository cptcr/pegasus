import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { CommandCategory } from '../../types/command';
import { createLocalizationMap, commandDescriptions } from '../../utils/localization';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('fun')
  .setDescription('Fun and entertainment commands')
  .setDescriptionLocalizations(createLocalizationMap(commandDescriptions.fun))
  .addSubcommand(subcommand =>
    subcommand.setName('meme').setDescription('Get a random meme').setDescriptionLocalizations({
      de: 'Ein zufälliges Meme erhalten',
      'es-ES': 'Obtener un meme aleatorio',
      fr: 'Obtenir un mème aléatoire',
    })
  )
  .addSubcommand(subcommand =>
    subcommand.setName('fact').setDescription('Get a random fact').setDescriptionLocalizations({
      de: 'Eine zufällige Tatsache erhalten',
      'es-ES': 'Obtener un dato aleatorio',
      fr: 'Obtenir un fait aléatoire',
    })
  )
  .addSubcommand(subcommand =>
    subcommand.setName('quote').setDescription('Get a random quote').setDescriptionLocalizations({
      de: 'Ein zufälliges Zitat erhalten',
      'es-ES': 'Obtener una cita aleatoria',
      fr: 'Obtenir une citation aléatoire',
    })
  )
  .addSubcommand(subcommand =>
    subcommand.setName('joke').setDescription('Get a random joke').setDescriptionLocalizations({
      de: 'Einen zufälligen Witz erhalten',
      'es-ES': 'Obtener un chiste aleatorio',
      fr: 'Obtenir une blague aléatoire',
    })
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('dadjoke')
      .setDescription('Get a random dad joke')
      .setDescriptionLocalizations({
        de: 'Einen zufälligen Dad-Joke erhalten',
        'es-ES': 'Obtener un chiste de papá aleatorio',
        fr: 'Obtenir une blague de papa aléatoire',
      })
  );

export const category = CommandCategory.Fun;
export const cooldown = 5;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!config.ENABLE_FUN_COMMANDS) {
    await interaction.reply({
      content: 'Fun commands are currently disabled.',
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  await interaction.deferReply();

  try {
    switch (subcommand) {
      case 'meme':
        await handleMeme(interaction);
        break;
      case 'fact':
        await handleFact(interaction);
        break;
      case 'quote':
        await handleQuote(interaction);
        break;
      case 'joke':
        await handleJoke(interaction);
        break;
      case 'dadjoke':
        await handleDadJoke(interaction);
        break;
    }
  } catch (error) {
    logger.error('Error in fun command:', error);
    await interaction.editReply({
      content: 'An error occurred while fetching content. Please try again later.',
    });
  }
}

async function handleMeme(interaction: ChatInputCommandInteraction) {
  try {
    // Using Reddit API (no key required)
    const response = await axios.get('https://meme-api.com/gimme', {
      timeout: 5000,
    });

    const meme = response.data;

    if (!meme || !meme.url) {
      throw new Error('Invalid meme data received');
    }

    const embed = new EmbedBuilder()
      .setColor(0xff4500)
      .setTitle(meme.title || 'Random Meme')
      .setImage(meme.url)
      .setFooter({ text: `From r/${meme.subreddit || 'memes'}` })
      .setTimestamp();

    if (meme.author) {
      embed.setAuthor({ name: `u/${meme.author}` });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // Fallback to alternative API
    try {
      const response = await axios.get('https://api.imgflip.com/get_memes', {
        timeout: 5000,
      });

      const memes = response.data.data.memes;
      const randomMeme = memes[Math.floor(Math.random() * memes.length)];

      const embed = new EmbedBuilder()
        .setColor(0xff4500)
        .setTitle(randomMeme.name)
        .setImage(randomMeme.url)
        .setFooter({ text: 'Powered by Imgflip' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (fallbackError) {
      throw fallbackError;
    }
  }
}

async function handleFact(interaction: ChatInputCommandInteraction) {
  try {
    const response = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random', {
      timeout: 5000,
      headers: {
        Accept: 'application/json',
      },
    });

    const fact = response.data;

    const embed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle('Random Fact')
      .setDescription(fact.text)
      .setFooter({ text: fact.source || 'Unknown Source' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // Fallback to alternative API
    try {
      const response = await axios.get('https://api.api-ninjas.com/v1/facts', {
        timeout: 5000,
        headers: {
          Accept: 'application/json',
        },
      });

      const fact = response.data[0];

      const embed = new EmbedBuilder()
        .setColor(0x00ae86)
        .setTitle('Random Fact')
        .setDescription(fact.fact)
        .setFooter({ text: 'Powered by API Ninjas' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (fallbackError) {
      // Final fallback with hardcoded facts
      const facts = [
        'Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.',
        "A group of flamingos is called a 'flamboyance'.",
        'Octopuses have three hearts and blue blood.',
        'The shortest war in history lasted only 38-45 minutes between Britain and Zanzibar in 1896.',
        "Bananas are berries, but strawberries aren't.",
      ];

      const randomFact = facts[Math.floor(Math.random() * facts.length)];

      const embed = new EmbedBuilder()
        .setColor(0x00ae86)
        .setTitle('Random Fact')
        .setDescription(randomFact)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}

async function handleQuote(interaction: ChatInputCommandInteraction) {
  try {
    const response = await axios.get('https://api.quotable.io/random', {
      timeout: 5000,
    });

    const quote = response.data;

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('Random Quote')
      .setDescription(`"${quote.content}"`)
      .setFooter({ text: `— ${quote.author}` })
      .setTimestamp();

    if (quote.tags && quote.tags.length > 0) {
      embed.addFields({
        name: 'Tags',
        value: quote.tags.join(', '),
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // Fallback to alternative API
    try {
      const response = await axios.get('https://zenquotes.io/api/random', {
        timeout: 5000,
      });

      const quote = response.data[0];

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('Random Quote')
        .setDescription(`"${quote.q}"`)
        .setFooter({ text: `— ${quote.a}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (fallbackError) {
      // Final fallback with hardcoded quotes
      const quotes = [
        { content: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
        {
          content: 'Innovation distinguishes between a leader and a follower.',
          author: 'Steve Jobs',
        },
        {
          content: "Life is what happens when you're busy making other plans.",
          author: 'John Lennon',
        },
        {
          content: 'The future belongs to those who believe in the beauty of their dreams.',
          author: 'Eleanor Roosevelt',
        },
        {
          content: 'It is during our darkest moments that we must focus to see the light.',
          author: 'Aristotle',
        },
      ];

      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('Random Quote')
        .setDescription(`"${randomQuote.content}"`)
        .setFooter({ text: `— ${randomQuote.author}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}

async function handleJoke(interaction: ChatInputCommandInteraction) {
  try {
    const response = await axios.get('https://official-joke-api.appspot.com/random_joke', {
      timeout: 5000,
    });

    const joke = response.data;

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('Random Joke')
      .setDescription(`**${joke.setup}**\n\n||${joke.punchline}||`)
      .setFooter({ text: `Type: ${joke.type || 'General'}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // Fallback to alternative API
    try {
      const response = await axios.get('https://v2.jokeapi.dev/joke/Any?safe-mode&type=twopart', {
        timeout: 5000,
      });

      const joke = response.data;

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('Random Joke')
        .setDescription(`**${joke.setup}**\n\n||${joke.delivery}||`)
        .setFooter({ text: `Category: ${joke.category}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (fallbackError) {
      // Final fallback with hardcoded jokes
      const jokes = [
        {
          setup: "Why don't scientists trust atoms?",
          punchline: 'Because they make up everything!',
        },
        {
          setup: 'Why did the scarecrow win an award?',
          punchline: 'He was outstanding in his field!',
        },
        { setup: "Why don't eggs tell jokes?", punchline: "They'd crack each other up!" },
        { setup: 'What do you call a fake noodle?', punchline: 'An impasta!' },
        { setup: 'Why did the bicycle fall over?', punchline: 'It was two-tired!' },
      ];

      const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('Random Joke')
        .setDescription(`**${randomJoke.setup}**\n\n||${randomJoke.punchline}||`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}

async function handleDadJoke(interaction: ChatInputCommandInteraction) {
  try {
    const response = await axios.get('https://icanhazdadjoke.com/', {
      timeout: 5000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Pegasus Discord Bot (https://github.com/cptcr/pegasus)',
      },
    });

    const joke = response.data;

    const embed = new EmbedBuilder()
      .setColor(0x1e90ff)
      .setTitle('Dad Joke')
      .setDescription(joke.joke)
      .setFooter({ text: 'Powered by icanhazdadjoke.com' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // Fallback with hardcoded dad jokes
    const dadJokes = [
      "I'm afraid for the calendar. Its days are numbered.",
      'My wife said I should do lunges to stay in shape. That would be a big step forward.',
      'Why do fathers take an extra pair of socks when they go golfing? In case they get a hole in one!',
      "Singing in the shower is fun until you get soap in your mouth. Then it's a soap opera.",
      "What do a tick and the Eiffel Tower have in common? They're both Paris sites.",
      'What do you call a factory that makes okay products? A satisfactory.',
      'Dear Math, grow up and solve your own problems.',
      'What did the janitor say when he jumped out of the closet? Supplies!',
      'Have you heard about the chocolate record player? It sounds pretty sweet.',
      'What did the ocean say to the beach? Nothing, it just waved.',
    ];

    const randomJoke = dadJokes[Math.floor(Math.random() * dadJokes.length)];

    const embed = new EmbedBuilder()
      .setColor(0x1e90ff)
      .setTitle('Dad Joke')
      .setDescription(randomJoke)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
