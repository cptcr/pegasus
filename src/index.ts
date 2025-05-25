// src/index.ts - Haupteinstiegspunkt für den Bot
import { config } from 'dotenv';
import { Client, GatewayIntentBits, Partials, Collection, Events } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { registerCommands } from './commands';
import { registerEvents } from './events';
import { loadFeatures } from './features';
import { BotConfig, ClientWithCommands } from './types'; // Angepasster Client-Typ
import { defaultConfig as botDefaultSettings } from '../../config'; // Import aus dem Hauptverzeichnis

// Umgebungsvariablen laden
config();

// Discord-Client mit erforderlichen Intents erstellen
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent, // Erforderlich für Prefix-Befehle
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
}) as ClientWithCommands; // Cast zum erweiterten Client-Typ

// Prisma initialisieren
const prisma = new PrismaClient();

// Bot-Konfigurationsobjekt
// Die devGuilds, devUsers, devRoles werden jetzt aus der Haupt-config.ts geladen
const botConfig: BotConfig = {
  devGuilds: botDefaultSettings.devGuilds,
  devUsers: botDefaultSettings.devUsers,
  devRoles: botDefaultSettings.devRoles,
  defaultPrefix: process.env.DEFAULT_PREFIX || '!', // Standard-Prefix aus .env oder '!'
  enabledFeatures: {
    leveling: process.env.ENABLE_LEVELING !== 'false',
    moderation: process.env.ENABLE_MODERATION !== 'false',
    geizhals: process.env.ENABLE_GEIZHALS === 'true',
    polls: process.env.ENABLE_POLLS !== 'false',
    giveaways: process.env.ENABLE_GIVEAWAYS !== 'false',
    tickets: process.env.ENABLE_TICKETS === 'true',
    music: process.env.ENABLE_MUSIC === 'true', // Standardmäßig deaktiviert, falls nicht gesetzt
    joinToCreate: process.env.ENABLE_JOIN_TO_CREATE === 'true', // Standardmäßig deaktiviert
  },
  debug: process.env.DEBUG === 'true',
};

// Collections auf dem Client initialisieren
client.commands = new Collection();
client.slashCommands = new Collection();
client.cooldowns = new Collection();
client.config = botConfig;
client.prisma = prisma;

// Event-Handler registrieren
registerEvents(client);

// Befehle registrieren (Slash und Prefix)
// Die Registrierung von Slash-Befehlen erfolgt jetzt im 'ready'-Event,
// nachdem der Client initialisiert wurde und client.user!.id verfügbar ist.
// registerCommands(client) wird später aufgerufen.

// Alle Features laden
loadFeatures(client);

// Bei Discord mit dem Bot-Token anmelden
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => {
    console.log(`🤖 Bot angemeldet als ${client.user?.tag}`);
  })
  .catch(error => {
    console.error('Fehler beim Anmelden des Bots:', error);
    process.exit(1);
  });

// Prozessbeendigung handhaben
const handleExit = async () => {
  console.log('Bot wird heruntergefahren...');
  client.destroy();
  await prisma.$disconnect();
  console.log('Bot erfolgreich heruntergefahren.');
  process.exit(0);
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('unhandledRejection', (error) => {
  console.error('Unerwarteter Promise-Fehler:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Ungefangene Ausnahme:', error);
  // Optional: Graceful shutdown hier, aber Vorsicht vor Endlosschleifen
  // handleExit();
});
