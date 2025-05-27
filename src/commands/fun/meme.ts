// src/commands/fun/meme.ts - Fixed Meme Generator Fun Command
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: 'meme',
  description: 'Get a random meme or create a custom meme',
  category: 'fun',
  usage: '/meme [template] [top_text] [bottom_text]',
  examples: [
    '/meme',
    '/meme template:drake top_text:"Studying" bottom_text:"Playing games"',
    '/meme template:distracted_boyfriend top_text:"Me" bottom_text:"New hobby"'
  ],
  cooldown: 5,
  guildOnly: false
};

// Popular meme templates
const memeTemplates = [
  { name: 'Drake', value: 'drake', description: 'Drake pointing meme template' },
  { name: 'Distracted Boyfriend', value: 'distracted_boyfriend', description: 'Distracted boyfriend meme' },
  { name: 'Woman Yelling at Cat', value: 'woman_yelling_at_cat', description: 'Woman yelling at cat meme' },
  { name: 'Change My Mind', value: 'change_my_mind', description: 'Change my mind meme' },
  { name: 'Expanding Brain', value: 'expanding_brain', description: 'Expanding brain meme' },
  { name: 'This is Fine', value: 'this_is_fine', description: 'This is fine dog meme' },
  { name: 'Stonks', value: 'stonks', description: 'Stonks meme' },
  { name: 'Surprised Pikachu', value: 'surprised_pikachu', description: 'Surprised Pikachu meme' },
  { name: 'Galaxy Brain', value: 'galaxy_brain', description: 'Galaxy brain meme' },
  { name: 'Two Buttons', value: 'two_buttons', description: 'Two buttons meme' },
  { name: 'Is This a Pigeon?', value: 'is_this_a_pigeon', description: 'Is this a pigeon meme' },
  { name: 'Monkey Puppet', value: 'monkey_puppet', description: 'Monkey puppet looking away' },
  { name: 'Kermit Sipping Tea', value: 'kermit_tea', description: 'But that\'s none of my business' },
  { name: 'Success Kid', value: 'success_kid', description: 'Success kid fist pump' },
  { name: 'Ancient Aliens Guy', value: 'ancient_aliens', description: 'Ancient aliens guy' },
  { name: 'One Does Not Simply', value: 'one_does_not_simply', description: 'One does not simply' },
  { name: 'Grumpy Cat', value: 'grumpy_cat', description: 'Grumpy cat' },
  { name: 'Roll Safe', value: 'roll_safe', description: 'Roll safe think about it' },
  { name: 'Mocking SpongeBob', value: 'mocking_spongebob', description: 'Mocking SpongeBob' },
  { name: 'Doge', value: 'doge', description: 'Doge wow much meme' }
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Get a random meme or create a custom meme')
    .addStringOption(option =>
      option.setName('template')
        .setDescription('Meme template to use')
        .setRequired(false)
        .addChoices(...memeTemplates.slice(0, 25))) // Discord limit
    .addStringOption(option =>
      option.setName('top_text')
        .setDescription('Top text for the meme')
        .setMaxLength(100)
        .setRequired(false))
    .addStringOption(option =>
      option.setName('bottom_text')
        .setDescription('Bottom text for the meme')
        .setMaxLength(100)
        .setRequired(false)),
  category: 'fun',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
    const template = interaction.options.getString('template');
    const topText = interaction.options.getString('top_text');
    const bottomText = interaction.options.getString('bottom_text');

    await interaction.deferReply();

    try {
      if (!template && !topText && !bottomText) {
        // Get random meme from Reddit or other API
        const randomMeme = await getRandomMeme();
        
        if (!randomMeme) {
          await interaction.editReply({
            content: '❌ Failed to fetch a random meme. Please try again later.'
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(`😂 ${randomMeme.title}`)
          .setImage(randomMeme.url)
          .setColor(Config.COLORS.INFO)
          .setFooter({ 
            text: `👍 ${randomMeme.ups || 0} • r/${randomMeme.subreddit} • Posted by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();

        if (randomMeme.author) {
          embed.addFields({
            name: 'Original Author',
            value: `u/${randomMeme.author}`,
            inline: true
          });
        }

        await interaction.editReply({ embeds: [embed] });

      } else {
        // Create custom meme
        if (!template) {
          await interaction.editReply({
            content: '❌ Please specify a meme template when adding custom text.'
          });
          return;
        }

        const customMeme = await createCustomMeme(template, topText || '', bottomText || '');
        
        if (!customMeme) {
          await interaction.editReply({
            content: '❌ Failed to create custom meme. Please try again later or check if the template is valid.'
          });
          return;
        }

        const templateInfo = memeTemplates.find(t => t.value === template);
        
        const embed = new EmbedBuilder()
          .setTitle(`🎨 Custom Meme: ${templateInfo?.name || template}`)
          .setImage(customMeme.url)
          .setColor(Config.COLORS.SUCCESS)
          .setFooter({ 
            text: `Meme created by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();

        if (topText || bottomText) {
          embed.addFields({
            name: '📝 Meme Text',
            value: [
              topText ? `**Top:** ${topText}` : '',
              bottomText ? `**Bottom:** ${bottomText}` : ''
            ].filter(Boolean).join('\n'),
            inline: false
          });
        }

        await interaction.editReply({ embeds: [embed] });
      }

      // Log for fun stats
      if (interaction.guild) {
        client.wsManager.emitRealtimeEvent(interaction.guild.id, 'fun:meme_generated', {
          userId: interaction.user.id,
          template: template,
          isCustom: !!(template || topText || bottomText)
        });
      }

      client.logger.debug(`${interaction.user.tag} generated a meme${template ? ` using template: ${template}` : ' (random)'}`);

    } catch (error) {
      client.logger.error('Error generating meme:', error);
      
      await interaction.editReply({
        content: '❌ An error occurred while generating the meme. Please try again later.'
      });
    }
  }
};

interface RandomMeme {
  title: string;
  url: string;
  subreddit: string;
  author?: string;
  ups?: number;
}

async function getRandomMeme(): Promise<RandomMeme | null> {
  try {
    // Fetch from Reddit's JSON API (no auth required for public posts)
    const subreddits = ['memes', 'dankmemes', 'wholesomememes', 'memeeconomy', 'PrequelMemes'];
    const randomSubreddit = subreddits[Math.floor(Math.random() * subreddits.length)];
    
    const response = await fetch(`https://www.reddit.com/r/${randomSubreddit}/hot.json?limit=100`, {
      headers: {
        'User-Agent': 'DiscordBot/1.0'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const posts = data.data.children;
    
    // Filter for image posts
    const imagePosts = posts.filter((post: any) => {
      const url = post.data.url;
      return url && (
        url.includes('.jpg') || 
        url.includes('.jpeg') || 
        url.includes('.png') || 
        url.includes('.gif') ||
        url.includes('i.redd.it') ||
        url.includes('i.imgur.com')
      ) && !post.data.over_18; // Filter out NSFW content
    });

    if (imagePosts.length === 0) {
      return null;
    }

    const randomPost = imagePosts[Math.floor(Math.random() * imagePosts.length)];
    
    return {
      title: randomPost.data.title,
      url: randomPost.data.url,
      subreddit: randomPost.data.subreddit,
      author: randomPost.data.author,
      ups: randomPost.data.ups
    };

  } catch (error) {
    console.error('Error fetching random meme:', error);
    return null;
  }
}

interface CustomMeme {
  url: string;
  template: string;
}

async function createCustomMeme(template: string, topText: string, bottomText: string): Promise<CustomMeme | null> {
  try {
    // This is a mock implementation. In a real bot, you would use:
    // - ImgFlip API (requires API key)
    // - Canvas library to draw text on images
    // - Third-party meme generation service
    
    // Mock response for demonstration
    return {
      url: `https://api.memegen.link/${template}/${encodeURIComponent(topText || '_')}/${encodeURIComponent(bottomText || '_')}.jpg`,
      template: template
    };

  } catch (error) {
    console.error('Error creating custom meme:', error);
    return null;
  }
}

export default command;