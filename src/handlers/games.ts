import { 
  TextChannel, 
  ButtonInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  User,
  GuildMember
} from 'discord.js';
import { db } from '../database/connection';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../utils/helpers';
import { colors, emojis } from '../utils/config';

interface TriviaQuestion {
  question: string;
  answers: string[];
  correct: number;
  category: string;
  difficulty: string;
}

interface GameParticipant {
  userId: string;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
}

export class GameHandler {
  private static instance: GameHandler;
  private triviaQuestions: TriviaQuestion[] = [];
  private activeGames = new Map<string, any>();

  public static getInstance(): GameHandler {
    if (!GameHandler.instance) {
      GameHandler.instance = new GameHandler();
    }
    return GameHandler.instance;
  }

  constructor() {
    this.loadTriviaQuestions();
  }

  private loadTriviaQuestions(): void {
    this.triviaQuestions = [
      {
        question: "What is the capital of France?",
        answers: ["London", "Berlin", "Paris", "Madrid"],
        correct: 2,
        category: "Geography",
        difficulty: "easy"
      },
      {
        question: "Which planet is known as the Red Planet?",
        answers: ["Venus", "Mars", "Jupiter", "Saturn"],
        correct: 1,
        category: "Science",
        difficulty: "easy"
      },
      {
        question: "What is the largest mammal in the world?",
        answers: ["African Elephant", "Blue Whale", "Giraffe", "Hippopotamus"],
        correct: 1,
        category: "Nature",
        difficulty: "easy"
      },
      {
        question: "Who painted the Mona Lisa?",
        answers: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Michelangelo"],
        correct: 2,
        category: "Art",
        difficulty: "medium"
      },
      {
        question: "What is the chemical symbol for gold?",
        answers: ["Go", "Gd", "Au", "Ag"],
        correct: 2,
        category: "Science",
        difficulty: "medium"
      },
      {
        question: "Which country has won the most FIFA World Cups?",
        answers: ["Germany", "Argentina", "Italy", "Brazil"],
        correct: 3,
        category: "Sports",
        difficulty: "medium"
      },
      {
        question: "What is the smallest country in the world?",
        answers: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"],
        correct: 1,
        category: "Geography",
        difficulty: "hard"
      },
      {
        question: "Who wrote the novel '1984'?",
        answers: ["Aldous Huxley", "George Orwell", "Ray Bradbury", "J.K. Rowling"],
        correct: 1,
        category: "Literature",
        difficulty: "hard"
      },
      {
        question: "What is the speed of light in vacuum?",
        answers: ["299,792,458 m/s", "300,000,000 m/s", "299,000,000 m/s", "301,000,000 m/s"],
        correct: 0,
        category: "Physics",
        difficulty: "hard"
      }
    ];
  }

  public async startTriviaGame(
    guildId: string,
    channelId: string,
    hostId: string,
    rounds: number = 10
  ): Promise<void> {
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.activeGames.has(gameId)) {
      return;
    }

    const gameSession = {
      id: gameId,
      guildId,
      channelId,
      gameType: 'trivia',
      hostId,
      participants: new Map<string, GameParticipant>(),
      status: 'waiting',
      currentRound: 0,
      totalRounds: rounds,
      currentQuestion: null,
      questionTimeout: null,
      settings: {
        timePerQuestion: 30000,
        pointsPerCorrect: 100,
        pointsPerSpeed: 50,
      },
      startTime: Date.now(),
    };

    this.activeGames.set(gameId, gameSession);

    await db.query(
      `INSERT INTO game_sessions (id, guild_id, channel_id, game_type, host_id, status, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [gameId, guildId, channelId, 'trivia', hostId, 'waiting', JSON.stringify(gameSession.settings)]
    );

    const embed = createEmbed({
      title: `${emojis.game} Trivia Game Starting!`,
      description: `A trivia game has been started by <@${hostId}>\n\n` +
                   `**Rounds:** ${rounds}\n` +
                   `**Time per question:** 30 seconds\n` +
                   `**Points per correct answer:** 100\n\n` +
                   `Click the button below to join!`,
      color: colors.primary,
      footer: 'Game will start in 30 seconds',
    });

    const button = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`trivia_join_${gameId}`)
          .setLabel('Join Game')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎮')
      );

    const channel = global.client?.channels.cache.get(channelId) as TextChannel;
    if (channel) {
      await channel.send({ embeds: [embed], components: [button] });
    }

    setTimeout(() => {
      this.startTriviaRounds(gameId);
    }, 30000);
  }

  public async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.customId.startsWith('trivia_')) return;

    const [_, action, gameId, ...rest] = interaction.customId.split('_');

    switch (action) {
      case 'join':
        await this.handleJoinGame(interaction, gameId);
        break;
      case 'answer':
        await this.handleAnswerSubmission(interaction, gameId, parseInt(rest[0]));
        break;
    }
  }

  private async handleJoinGame(interaction: ButtonInteraction, gameId: string): Promise<void> {
    const game = this.activeGames.get(gameId);
    if (!game) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'Game not found.')],
        ephemeral: true,
      });
      return;
    }

    if (game.status !== 'waiting') {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'Game has already started.')],
        ephemeral: true,
      });
      return;
    }

    if (game.participants.has(interaction.user.id)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'You are already in this game.')],
        ephemeral: true,
      });
      return;
    }

    game.participants.set(interaction.user.id, {
      userId: interaction.user.id,
      score: 0,
      correctAnswers: 0,
      totalAnswers: 0,
    });

    await interaction.reply({
      embeds: [createSuccessEmbed('Joined!', 'You have joined the trivia game.')],
      ephemeral: true,
    });
  }

  private async startTriviaRounds(gameId: string): Promise<void> {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    if (game.participants.size < 1) {
      const channel = global.client?.channels.cache.get(game.channelId) as TextChannel;
      if (channel) {
        await channel.send({
          embeds: [createErrorEmbed('Game Cancelled', 'Not enough participants to start the game.')],
        });
      }
      this.activeGames.delete(gameId);
      return;
    }

    game.status = 'active';
    await this.nextQuestion(gameId);
  }

  private async nextQuestion(gameId: string): Promise<void> {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    game.currentRound++;

    if (game.currentRound > game.totalRounds) {
      await this.endGame(gameId);
      return;
    }

    const question = this.getRandomQuestion();
    game.currentQuestion = question;

    const embed = createEmbed({
      title: `${emojis.game} Question ${game.currentRound}/${game.totalRounds}`,
      description: `**Category:** ${question.category}\n**Difficulty:** ${question.difficulty}\n\n${question.question}`,
      color: colors.primary,
      footer: 'You have 30 seconds to answer',
    });

    const buttons = new ActionRowBuilder<ButtonBuilder>();
    question.answers.forEach((answer, index) => {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`trivia_answer_${gameId}_${index}`)
          .setLabel(`${String.fromCharCode(65 + index)}. ${answer}`)
          .setStyle(ButtonStyle.Secondary)
      );
    });

    const channel = global.client?.channels.cache.get(game.channelId) as TextChannel;
    if (channel) {
      await channel.send({ embeds: [embed], components: [buttons] });
    }

    game.questionTimeout = setTimeout(() => {
      this.revealAnswer(gameId);
    }, 30000);
  }

  private async handleAnswerSubmission(
    interaction: ButtonInteraction,
    gameId: string,
    answerIndex: number
  ): Promise<void> {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    if (game.status !== 'active') {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'Game is not active.')],
        ephemeral: true,
      });
      return;
    }

    const participant = game.participants.get(interaction.user.id);
    if (!participant) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'You are not in this game.')],
        ephemeral: true,
      });
      return;
    }

    const question = game.currentQuestion;
    if (!question) return;

    participant.totalAnswers++;
    const isCorrect = answerIndex === question.correct;

    if (isCorrect) {
      participant.correctAnswers++;
      participant.score += game.settings.pointsPerCorrect;
    }

    await interaction.reply({
      embeds: [createEmbed({
        title: isCorrect ? `${emojis.success} Correct!` : `${emojis.error} Wrong!`,
        description: `The correct answer was: **${question.answers[question.correct]}**`,
        color: isCorrect ? colors.success : colors.error,
      })],
      ephemeral: true,
    });
  }

  private async revealAnswer(gameId: string): Promise<void> {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    const question = game.currentQuestion;
    if (!question) return;

    const embed = createEmbed({
      title: `${emojis.info} Answer Revealed`,
      description: `The correct answer was: **${question.answers[question.correct]}**`,
      color: colors.info,
    });

    const channel = global.client?.channels.cache.get(game.channelId) as TextChannel;
    if (channel) {
      await channel.send({ embeds: [embed] });
    }

    setTimeout(() => {
      this.nextQuestion(gameId);
    }, 3000);
  }

  private async endGame(gameId: string): Promise<void> {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    game.status = 'ended';

    const participants = Array.from(game.participants.values())
      .sort((a: any, b: any) => b.score - a.score);

    const embed = createEmbed({
      title: `${emojis.crown} Trivia Game Results`,
      description: `Game completed! Here are the final results:`,
      color: colors.success,
      timestamp: true,
    });

    let leaderboard = '';
    const medals = ['🥇', '🥈', '🥉'];

    participants.forEach((participant: any, index) => {
      const medal = medals[index] || `**${index + 1}.**`;
      const user = global.client?.users.cache.get(participant.userId);
      const accuracy = participant.totalAnswers > 0 
        ? Math.round((participant.correctAnswers / participant.totalAnswers) * 100)
        : 0;

      leaderboard += `${medal} ${user?.username || 'Unknown'}\n`;
      leaderboard += `   Score: ${participant.score} • Accuracy: ${accuracy}%\n\n`;
    });

    embed.addFields({
      name: 'Leaderboard',
      value: leaderboard || 'No participants',
      inline: false,
    });

    const channel = global.client?.channels.cache.get(game.channelId) as TextChannel;
    if (channel) {
      await channel.send({ embeds: [embed] });
    }

    await db.query(
      'UPDATE game_sessions SET status = $1, scores = $2 WHERE id = $3',
      ['ended', JSON.stringify(Object.fromEntries(game.participants)), gameId]
    );

    this.activeGames.delete(gameId);
  }

  private getRandomQuestion(): TriviaQuestion {
    const randomIndex = Math.floor(Math.random() * this.triviaQuestions.length);
    return this.triviaQuestions[randomIndex];
  }

  public async getGameStats(guildId: string): Promise<any> {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN status = 'ended' THEN 1 END) as completed_games,
        AVG(CASE WHEN status = 'ended' THEN EXTRACT(EPOCH FROM (updated_at - created_at)) END) as avg_duration
       FROM game_sessions 
       WHERE guild_id = $1 AND game_type = 'trivia'`,
      [guildId]
    );

    return result.rows[0];
  }

  public isGameActive(channelId: string): boolean {
    for (const [gameId, game] of this.activeGames) {
      if (game.channelId === channelId && game.status === 'active') {
        return true;
      }
    }
    return false;
  }

  public async stopGame(channelId: string): Promise<boolean> {
    for (const [gameId, game] of this.activeGames) {
      if (game.channelId === channelId) {
        if (game.questionTimeout) {
          clearTimeout(game.questionTimeout);
        }
        await this.endGame(gameId);
        return true;
      }
    }
    return false;
  }
}

export const gameHandler = GameHandler.getInstance();