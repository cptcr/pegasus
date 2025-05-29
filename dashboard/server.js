// dashboard/server.js - Fixed Environment Loading
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { io: SocketIOClient } = require('socket.io-client');

// Load environment variables from root directory
require('dotenv').config({ path: '../.env' });

console.log('🔧 Dashboard environment loaded from root .env file');
console.log('🔍 Dashboard Environment Debug:');
console.log(`   DISCORD_CLIENT_ID: ${process.env.DISCORD_CLIENT_ID ? '✓ SET' : '❌ NOT SET'}`);
console.log(`   NEXTAUTH_SECRET: ${process.env.NEXTAUTH_SECRET ? '✓ SET' : '❌ NOT SET'}`);
console.log(`   TARGET_GUILD_ID: ${process.env.TARGET_GUILD_ID || 'NOT SET'}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✓ SET' : '❌ NOT SET'}`);
console.log('');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const dashboardPort = parseInt(process.env.DASHBOARD_PORT || '3001', 10);
const botWsUrl = process.env.BOT_WEBSOCKET_URL || 'ws://localhost:3002';
const targetGuildId = process.env.TARGET_GUILD_ID;

if (!process.env.NEXTAUTH_SECRET) {
  console.error('❌ NEXTAUTH_SECRET is required for the dashboard to work!');
  console.error('💡 Generate one with: openssl rand -base64 32');
  process.exit(1);
}

if (!process.env.DISCORD_CLIENT_SECRET) {
  console.error('❌ DISCORD_CLIENT_SECRET is required for OAuth!');
  process.exit(1);
}

const app = next({ dev, hostname, port: dashboardPort });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      await handle(req, res, parse(req.url, true));
    } catch (err) {
      console.error('Next.js request handling error:', err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // This is the server the dashboard frontend connects to
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });
  global.io = io;

  httpServer.listen(dashboardPort, (err) => {
    if (err) throw err;
    console.log(`✅ Dashboard Next.js app ready on http://${hostname}:${dashboardPort}`);
    initializeWebSocketBridge();
  });

  // This is the bridge that connects to the bot's WebSocket server
  const initializeWebSocketBridge = () => {
    console.log(`🔌 Dashboard bridge connecting to Bot WebSocket at ${botWsUrl}`);
    const botSocket = SocketIOClient(botWsUrl, {
      reconnectionDelayMax: 10000,
      transports: ['websocket'],
    });

    botSocket.on('connect', () => {
      console.log(`✅ Dashboard bridge connected to Bot WebSocket.`);
      if (targetGuildId) {
        botSocket.emit('join:guild', targetGuildId);
      }
    });

    botSocket.on('realtime:event', (event) => {
      console.log(`[BRIDGE] Received event [${event.type}] from bot, relaying to dashboard clients.`);
      io.to(`guild:${event.guildId}`).emit('realtime:event', event);
    });
    
    botSocket.on('disconnect', (reason) => {
      console.warn(`[BRIDGE] Disconnected from Bot WebSocket: ${reason}`);
    });
    
    botSocket.on('connect_error', (err) => {
      console.error(`[BRIDGE] Connection error with Bot WebSocket: ${err.message}`);
    });
  };

  io.on('connection', (socket) => {
    console.log(`[DASHBOARD] Client connected: ${socket.id}`);
    socket.on('join:guild', (guildId) => {
      if (guildId === targetGuildId) {
        socket.join(`guild:${guildId}`);
        console.log(`[DASHBOARD] Client ${socket.id} joined guild room: ${guildId}`);
      }
    });
    socket.on('disconnect', () => {
      console.log(`[DASHBOARD] Client disconnected: ${socket.id}`);
    });
  });

}).catch((ex) => {
  console.error('Failed to start dashboard server:', ex.stack);
  process.exit(1);
});