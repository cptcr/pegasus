// dashboard/server.js - Enhanced WebSocket Server
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.DASHBOARD_PORT) || 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO
  const io = new Server(server, {
    cors: {
      origin: process.env.NEXTAUTH_URL || `http://localhost:${port}`,
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Make io available globally for the bot to use
  global.io = io;

  // Connection handling
  io.on('connection', (socket) => {
    console.log(`📡 Client connected: ${socket.id}`);

    // Join guild-specific room
    socket.on('join:guild', (guildId) => {
      if (guildId === '554266392262737930') { // Only allow our specific guild
        socket.join(`guild:${guildId}`);
        console.log(`📡 Client ${socket.id} joined guild room: ${guildId}`);
        
        // Send initial connection confirmation
        socket.emit('connected', {
          message: 'Connected to real-time updates',
          guildId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle dashboard requests for live data
    socket.on('request:guild:stats', async (guildId) => {
      if (guildId === '554266392262737930') {
        try {
          // Mock response since we can't import DatabaseService here
          const stats = {
            totalUsers: 150,
            totalWarns: 5,
            activeQuarantine: 0,
            totalTrackers: 12,
            activePolls: 2,
            activeGiveaways: 1,
            openTickets: 3,
            customCommands: 8,
            levelRewards: 5,
            automodRules: 3
          };
          
          socket.emit('guild:stats:updated', {
            guildId,
            stats,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error fetching guild stats:', error);
          socket.emit('error', { message: 'Failed to fetch guild stats' });
        }
      }
    });

    socket.on('request:activity', async (guildId) => {
      if (guildId === '554266392262737930') {
        try {
          // Mock activity data
          const activity = {
            recentWarns: 2,
            recentPolls: 1,
            recentGiveaways: 0,
            recentTickets: 2
          };
          
          socket.emit('activity:updated', {
            guildId,
            activity,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error fetching activity:', error);
          socket.emit('error', { message: 'Failed to fetch activity' });
        }
      }
    });

    // Handle dashboard actions
    socket.on('dashboard:action', async (data) => {
      const { action, guildId, payload } = data;
      
      if (guildId !== '554266392262737930') return;

      try {
        console.log(`Dashboard action: ${action}`, payload);
        
        // Emit success response
        socket.emit('action:success', {
          action,
          guildId,
          timestamp: new Date().toISOString()
        });

        // Broadcast update to all clients in the guild room
        io.to(`guild:${guildId}`).emit('realtime:event', {
          type: action.replace(':', '_'),
          guildId,
          data: payload,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Error handling dashboard action:', error);
        socket.emit('error', { 
          message: 'Failed to execute action',
          action,
          error: error.message 
        });
      }
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`📡 Client disconnected: ${socket.id} (${reason})`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Periodic stats broadcast (every 30 seconds)
  setInterval(async () => {
    try {
      const guildId = '554266392262737930';
      
      // Mock data for periodic updates
      const stats = {
        totalUsers: 150 + Math.floor(Math.random() * 10),
        totalWarns: 5,
        activeQuarantine: 0,
        totalTrackers: 12,
        activePolls: 2,
        activeGiveaways: 1,
        openTickets: 3,
        customCommands: 8,
        levelRewards: 5,
        automodRules: 3
      };

      const activity = {
        recentWarns: Math.floor(Math.random() * 5),
        recentPolls: Math.floor(Math.random() * 3),
        recentGiveaways: Math.floor(Math.random() * 2),
        recentTickets: Math.floor(Math.random() * 5)
      };

      io.to(`guild:${guildId}`).emit('periodic:update', {
        guildId,
        stats,
        activity,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error in periodic update:', error);
    }
  }, 30000);

  // Health check endpoint for the WebSocket server
  const healthCheck = () => {
    return {
      status: 'healthy',
      connectedClients: io.engine.clientsCount,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  };

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`🌐 Dashboard server ready on http://${hostname}:${port}`);
    console.log(`📡 WebSocket server ready for real-time updates`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down dashboard server...');
    io.close(() => {
      console.log('📡 WebSocket server closed');
      server.close(() => {
        console.log('🌐 HTTP server closed');
        process.exit(0);
      });
    });
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down dashboard server...');
    io.close(() => {
      console.log('📡 WebSocket server closed');
      server.close(() => {
        console.log('🌐 HTTP server closed');
        process.exit(0);
      });
    });
  });

});