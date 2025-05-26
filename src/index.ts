// src/index.ts
import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { createServer, Server as HTTPServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { Command, BotEvent } from '@/types';
import { CommandHandler } from '@/handlers/CommandHandler';
import { EventHandler } from '@/handlers/EventHandler';
import { ButtonHandler } from '@/handlers/ButtonHandler';
import { GiveawayManager } from '@/modules/giveaways/GiveawayManager';
import { PollManager } from '@/modules/polls/PollManager';
import { TicketManager } from '@/modules/tickets/TicketManager';
import { Join2CreateManager } from '@/modules/voice/Join2CreateManager';
import { QuarantineManager } from '@/modules/quarantine/QuarantineManager';
import { WebSocketManager } from '@/api/WebSocketManager';
import { Logger } from '@/utils/Logger';
import { Config } from '@/config/Config';
import 'dotenv/config';

export class ExtendedClient extends Client {
  public readonly commands: Collection<string, Command> = new Collection();
  public readonly events: Collection<string, BotEvent<keyof import('discord.js').ClientEvents>> = new Collection();
  public readonly cooldowns: Collection<string, Collection<string, number>> = new Collection();
  
  public readonly db: PrismaClient;
  public readonly logger: typeof Logger;
  
  public readonly commandHandler: CommandHandler;
  public readonly eventHandler: EventHandler;
  public readonly buttonHandler: ButtonHandler;
  
  public readonly giveawayManager: GiveawayManager;
  public readonly pollManager: PollManager;
  public readonly ticketManager: TicketManager;
  public readonly j2cManager: Join2CreateManager;
  public readonly quarantineManager: QuarantineManager;
  
  public readonly httpServer: HTTPServer;
  public readonly wsManager: WebSocketManager;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
    });

    this.logger = Logger;
    this.db = new PrismaClient();
    
    this.commandHandler = new CommandHandler(this);
    this.eventHandler = new EventHandler(this);
    this.buttonHandler = new ButtonHandler(this);

    // Initialize modules
    this.giveawayManager = new GiveawayManager(this);
    this.pollManager = new PollManager(this);
    this.ticketManager = new TicketManager(this);
    this.j2cManager = new Join2CreateManager(this);
    this.quarantineManager = new QuarantineManager(this);

    this.httpServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', message: 'Pegasus Bot is running' }));
    });
    
    this.wsManager = new WebSocketManager(this.httpServer, this);
  }

  public async start(): Promise<void> {
    this.logger.info('Starting Pegasus Bot...');
    await this.db.$connect().catch(err => {
        this.logger.error('Failed to connect to database:', err);
        process.exit(1);
    });
    this.logger.info('Database connected successfully.');
    
    this.commandHandler.loadCommands();
    this.eventHandler.loadEvents();

    this.httpServer.listen(Config.API.WEBSOCKET_PORT, () => {
      this.logger.info(`Bot WebSocket Server listening on port ${Config.API.WEBSOCKET_PORT}`);
    });

    try {
      await this.login(process.env.DISCORD_BOT_TOKEN);
    } catch (error) {
      this.logger.error('Failed to login to Discord:', error);
      process.exit(1);
    }
  }
}

const client = new ExtendedClient();
client.start();