// src/commands/fun/8ball.ts - Magic 8-Ball Fun Command
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: '8ball',
  description: 'Ask the magic 8-ball a question',
  category: 'fun',
  usage: '/8ball <question>',
  examples: [
    '/8ball Will it rain tomorrow?',
    '/8ball Should I study for my exam?',
    '/8ball Is pizza the best food?'
  ],
  cooldown: 3,
  guildOnly: false
};

const responses = [
  // Positive responses
  { text: "It is certain.", type: "positive" },
  { text: "It is decidedly so.", type: "positive" },
  { text: "Without a doubt.", type: "positive" },
  { text: "Yes definitely.", type: "positive" },
  { text: "You may rely on it.", type: "positive" },
  { text: "As I see it, yes.", type: "positive" },
  { text: "Most likely.", type: "positive" },
  { text: "Outlook good.", type: "positive" },
  { text: "Yes.", type: "positive" },
  { text: "Signs point to yes.", type: "positive" },

  // Neutral/uncertain responses  
  { text: "Reply hazy, try again.", type: "neutral" },
  { text: "Ask again later.", type: "neutral" },
  { text: "Better not tell you now.", type: "neutral" },
  { text: "Cannot predict now.", type: "neutral" },
  { text: "Concentrate and ask again.", type: "neutral" },

  // Negative responses
  { text: "Don't count on it.", type: "negative" },
  { text: "My reply is no.", type: "negative" },
  { text: "My sources say no.", type: "negative" },
  { text: "Outlook not so good.", type: "negative" },
  { text: "Very doubtful.", type: "negative" }
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a question')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('Your question for the magic 8-ball')
        .setRequired(true)
        .setMaxLength(200)),
  category: 'fun',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    const question = interaction.options.getString('question', true);

    // Random response
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    // Determine color based on response type
    let color = Config.COLORS.INFO;
    let emoji = '🔮';
    
    switch (response.type) {
      case 'positive':
        color = Config.COLORS.SUCCESS;
        emoji = '✅';
        break;
      case 'negative':
        color = Config.COLORS.ERROR;
        emoji = '❌';
        break;
      case 'neutral':
        color = Config.COLORS.WARNING;
        emoji = '❓';
        break;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎱 Magic 8-Ball')
      .setDescription(`**Question:** ${question}`)
      .addFields({
        name: `${emoji} Answer`,
        value: `*${response.text}*`,
        inline: false
      })
      .setColor(color)
      .setFooter({ 
        text: `Asked by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Log the question (for fun stats)
    client.logger.debug(`8-ball question from ${interaction.user.tag}: "${question}" -> "${response.text}"`);
  }
};

export default command;