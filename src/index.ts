import { Client, GatewayIntentBits, Collection, ActivityType, PresenceUpdateStatus, Partials } from 'discord.js';
import { config } from 'dotenv';
import { CommandKit } from 'commandkit';
import chalk from 'chalk';
import * as path from 'node:path';
import { DatabaseService } from './lib/database';
import { devGuilds } from '../config';

// Environment laden
config();

// Client erstellen mit optimierten Intents
export const client: Client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildScheduledEvents,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
    ],
    presence: {
        status: PresenceUpdateStatus.Online,
        activities: [{
            name: '/help | Hinko Bot',
            type: ActivityType.Watching
        }]
    },
    // Performance Optimierungen
    rest: {
        timeout: 30000,
        retries: 3,
    },
    // Cache Optimierungen für niedrige Latenz
    makeCache: (manager) => {
        // Nur wichtige Daten cachen
        if (manager.name === 'MessageManager') {
            return new Collection(); // Nachrichten nicht cachen
        }
        return new Collection();
    },
    sweepers: {
        messages: {
            interval: 300, // 5 Minuten
            lifetime: 1800 // 30 Minuten
        },
        users: {
            interval: 3600, // 1 Stunde
            filter: () => user => user.bot && user.id !== client.user!.id
        }
    }
});

// CommandKit initialisieren
new CommandKit({
    client,
    commandsPath: path.join(__dirname, 'commands'),
    eventsPath: path.join(__dirname, 'events'),
    validationsPath: path.join(__dirname, 'validations'),
    devGuildIds: process.env.NODE_ENV === 'development' ? devGuilds : undefined,
    bulkRegister: true,
    skipBuiltInValidations: false
});

// Ready Event
client.once('ready', async () => {
    console.log(chalk.blue('🚀 Bot gestartet!'));
    console.log(chalk.green(`📡 Eingeloggt als ${client.user?.tag}`));
    console.log(chalk.yellow(`🔧 Auf ${client.guilds.cache.size} Servern aktiv`));
    
    // Datenbank initialisieren
    try {
        await DatabaseService.initialize();
        console.log(chalk.green('✅ Datenbank verbunden'));
    } catch (error) {
        console.error(chalk.red('❌ Datenbankfehler:'), error);
    }

    // Cron Jobs starten
    const { startCronJobs } = await import('./services/cronJobs');
    startCronJobs();
    console.log(chalk.cyan('⏰ Cron Jobs gestartet'));

    // Performance Monitoring
    setInterval(() => {
        const memUsage = process.memoryUsage();
        const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        if (memUsedMB > 500) { // Warnung bei über 500MB
            console.log(chalk.yellow(`⚠️ Hoher RAM-Verbrauch: ${memUsedMB}MB`));
        }
    }, 300000); // Alle 5 Minuten prüfen

    console.log(chalk.magenta('🎉 Hinko Bot ist bereit!'));
});

// Error Handling für Performance
client.on('error', (error) => {
    console.error(chalk.red('Discord Client Error:'), error);
});

client.on('warn', (warning) => {
    console.warn(chalk.yellow('Discord Client Warning:'), warning);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
});

process.on('uncaughtException', (error) => {
    console.error(chalk.red('Uncaught Exception:'), error);
    process.exit(1);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log(chalk.blue('🔄 Bot wird heruntergefahren...'));
    client.destroy();
    await DatabaseService.disconnect();
    process.exit(0);
});

// Bot anmelden
client.login(process.env.DISCORD_TOKEN);