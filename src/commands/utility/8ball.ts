import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createSuccessEmbed } from '../../utils/helpers';
import { emojis, colors } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('8ball')
  .setDescription('Ask the magic 8-ball a question')
  .addStringOption(option =>
    option.setName('question')
      .setDescription('Your question for the magic 8-ball')
      .setRequired(true)
      .setMaxLength(200)
  );

export async function execute(interaction: any) {
  const question = interaction.options.getString('question', true);

  // Magic 8-ball responses categorized by type
  const responses = {
    positive: [
      'It is certain.',
      'It is decidedly so.',
      'Without a doubt.',
      'Yes definitely.',
      'You may rely on it.',
      'As I see it, yes.',
      'Most likely.',
      'Outlook good.',
      'Yes.',
      'Signs point to yes.'
    ],
    negative: [
      'Don\'t count on it.',
      'My reply is no.',
      'My sources say no.',
      'Outlook not so good.',
      'Very doubtful.',
      'No.',
      'Absolutely not.',
      'I don\'t think so.',
      'The answer is no.',
      'Definitely not.'
    ],
    neutral: [
      'Reply hazy, try again.',
      'Ask again later.',
      'Better not tell you now.',
      'Cannot predict now.',
      'Concentrate and ask again.',
      'Maybe.',
      'It\'s possible.',
      'Uncertain.',
      'The future is unclear.',
      'Time will tell.'
    ]
  };

  // Randomly select a category and response
  const categories = Object.keys(responses);
  const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
  const categoryResponses = responses[selectedCategory as keyof typeof responses];
  const response = categoryResponses[Math.floor(Math.random() * categoryResponses.length)];

  // Determine embed color based on response type
  let embedColor: string;
  switch (selectedCategory) {
    case 'positive':
      embedColor = colors.success;
      break;
    case 'negative':
      embedColor = colors.error;
      break;
    default:
      embedColor = colors.warning;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.magic8ball} Magic 8-Ball`)
    .setColor(embedColor)
    .setTimestamp();

  embed.addFields(
    { name: '❓ Question', value: question, inline: false },
    { name: '🔮 Answer', value: `*${response}*`, inline: false }
  );

  // Add some flair based on response type
  const flairMessages = {
    positive: 'The magic 8-ball is optimistic! ✨',
    negative: 'The magic 8-ball has spoken with certainty. 🚫',
    neutral: 'The magic 8-ball suggests patience. ⏳'
  };

  embed.setFooter({ 
    text: flairMessages[selectedCategory as keyof typeof flairMessages],
    iconURL: interaction.user.displayAvatarURL() 
  });

  // Add a thumbnail for visual appeal
  const thumbnails = {
    positive: '✅',
    negative: '❌',
    neutral: '🤔'
  };

  // Create a more detailed response with emojis
  const responseWithEmoji = {
    positive: `✅ ${response}`,
    negative: `❌ ${response}`,
    neutral: `🤔 ${response}`
  };

  embed.setDescription(`Asked by: ${interaction.user}\n\n**${responseWithEmoji[selectedCategory as keyof typeof responseWithEmoji]}**`);

  await interaction.reply({ embeds: [embed] });
}