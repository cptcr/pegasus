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
import { trivia, TriviaQuestion } from '../data/trivia';


interface GameParticipant {
  userId: string;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
}

export class GameHandler {
  private static instance: GameHandler;
  private triviaQuestions: TriviaQuestion[] = trivia;
  private activeGames = new Map<string, any>();
  private readonly difficultyColors = {
    easy: 0x00ff00,
    medium: 0xffa500,
    hard: 0xff0000
  };
  private readonly difficultyPoints = {
    easy: 100,
    medium: 200,
    hard: 300
  };

  public static getInstance(): GameHandler {
    if (!GameHandler.instance) {
      GameHandler.instance = new GameHandler();
    }
    return GameHandler.instance;
  }

  public async startTriviaGame(
    guildId: string,
    channelId: string,
    hostId: string,
    rounds: number = 10,
    category?: string,
    difficulty?: string
  ): Promise<void> {
    // Generate a proper UUID for the game session
    const result = await db.query('SELECT gen_random_uuid() as id');
    const gameId = result.rows[0].id;
    
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
        category: category || 'all',
        difficulty: difficulty || 'all'
      },
      startTime: Date.now(),
      usedQuestions: new Set<number>()
    };

    this.activeGames.set(gameId, gameSession);

    await db.query(
      `INSERT INTO game_sessions (id, guild_id, channel_id, game_type, host_id, status, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [gameId, guildId, channelId, 'trivia', hostId, 'waiting', JSON.stringify(gameSession.settings)]
    );

    const categoryText = category ? `**Category:** ${category}\n` : '';
    const difficultyText = difficulty ? `**Difficulty:** ${difficulty}\n` : '';
    
    const embed = createEmbed({
      title: `${emojis.game} Trivia Game Starting!`,
      description: `A trivia game has been started by <@${hostId}>\n\n` +
                   `**Rounds:** ${rounds}\n` +
                   categoryText +
                   difficultyText +
                   `**Time per question:** 30 seconds\n` +
                   `**Points:** Easy: 100, Medium: 200, Hard: 300\n\n` +
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

    const question = this.getRandomQuestion(game.settings.category, game.settings.difficulty, game.usedQuestions);
    if (!question) {
      await this.endGame(gameId);
      return;
    }
    game.currentQuestion = question;
    game.usedQuestions.add(this.triviaQuestions.indexOf(question));

    const difficultyColor = this.difficultyColors[question.difficulty as keyof typeof this.difficultyColors] || colors.primary;
    const pointsForQuestion = this.difficultyPoints[question.difficulty as keyof typeof this.difficultyPoints] || 100;
    
    const embed = createEmbed({
      title: `${emojis.game} Question ${game.currentRound}/${game.totalRounds}`,
      description: `**Category:** ${question.category}\n**Difficulty:** ${question.difficulty} (${pointsForQuestion} points)\n\n${question.question}`,
      color: difficultyColor,
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

    game.questionStartTime = Date.now();
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
      const basePoints = this.difficultyPoints[question.difficulty as keyof typeof this.difficultyPoints] || 100;
      // Add speed bonus - more points for faster answers
      const timeBonus = Math.max(0, Math.floor((30000 - (Date.now() - game.questionStartTime)) / 1000) * 5);
      participant.score += basePoints + timeBonus;
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

  private getRandomQuestion(category?: string, difficulty?: string, usedQuestions?: Set<number>): TriviaQuestion | null {
    let availableQuestions = this.triviaQuestions;
    
    // Filter by category if specified
    if (category && category !== 'all') {
      availableQuestions = availableQuestions.filter(q => q.category.toLowerCase() === category.toLowerCase());
    }
    
    // Filter by difficulty if specified
    if (difficulty && difficulty !== 'all') {
      availableQuestions = availableQuestions.filter(q => q.difficulty.toLowerCase() === difficulty.toLowerCase());
    }
    
    // Filter out used questions
    if (usedQuestions) {
      availableQuestions = availableQuestions.filter((_, index) => !usedQuestions.has(index));
    }
    
    if (availableQuestions.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    return availableQuestions[randomIndex];
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

  // Get available categories
  public getAvailableCategories(): string[] {
    const categories = new Set<string>();
    this.triviaQuestions.forEach(q => categories.add(q.category));
    return Array.from(categories).sort();
  }

  // Get available difficulties
  public getAvailableDifficulties(): string[] {
    const difficulties = new Set<string>();
    this.triviaQuestions.forEach(q => difficulties.add(q.difficulty));
    return Array.from(difficulties).sort();
  }

  // Get question count for category/difficulty
  public getQuestionCount(category?: string, difficulty?: string): number {
    let questions = this.triviaQuestions;
    
    if (category && category !== 'all') {
      questions = questions.filter(q => q.category.toLowerCase() === category.toLowerCase());
    }
    
    if (difficulty && difficulty !== 'all') {
      questions = questions.filter(q => q.difficulty.toLowerCase() === difficulty.toLowerCase());
    }
    
    return questions.length;
  }

  // Get trivia statistics
  public getTriviaStats(): { totalQuestions: number; categories: string[]; difficulties: string[]; categoryStats: Record<string, number> } {
    const categories = this.getAvailableCategories();
    const difficulties = this.getAvailableDifficulties();
    const categoryStats: Record<string, number> = {};
    
    categories.forEach(category => {
      categoryStats[category] = this.getQuestionCount(category);
    });
    
    return {
      totalQuestions: this.triviaQuestions.length,
      categories,
      difficulties,
      categoryStats
    };
  }

  // Check if enough questions available for game
  public canStartGame(rounds: number, category?: string, difficulty?: string): boolean {
    const availableQuestions = this.getQuestionCount(category, difficulty);
    return availableQuestions >= rounds;
  }
}

export const gameHandler = GameHandler.getInstance();