// dashboard/server.js (WebSocket Server for Real-time Updates)
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { DatabaseService } = require('./lib/database');

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
          const stats = await DatabaseService.getGuildStats(guildId);
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
          const activity = await DatabaseService.getRecentActivity(guildId, 7);
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

    // Handle dashboard actions that should trigger bot events
    socket.on('dashboard:action', async (data) => {
      const { action, guildId, payload } = data;
      
      if (guildId !== '554266392262737930') return;

      try {
        switch (action) {
          case 'update:guild:settings':
            await DatabaseService.updateGuildSettings(guildId, payload);
            io.to(`guild:${guildId}`).emit('guild:settings:updated', {
              guildId,
              settings: payload,
              timestamp: new Date().toISOString()
            });
            break;

          case 'delete:warn':
            await DatabaseService.deleteWarn(payload.warnId);
            io.to(`guild:${guildId}`).emit('realtime:event', {
              type: 'warn:deleted',
              guildId,
              data: payload,
              timestamp: new Date().toISOString()
            });
            break;

          case 'close:ticket':
            await DatabaseService.closeTicket(payload.ticketId, payload.moderatorId);
            io.to(`guild:${guildId}`).emit('realtime:event', {
              type: 'ticket:closed',
              guildId,
              data: payload,
              timestamp: new Date().toISOString()
            });
            break;

          case 'end:poll':
            await DatabaseService.closePoll(payload.pollId);
            io.to(`guild:${guildId}`).emit('realtime:event', {
              type: 'poll:ended',
              guildId,
              data: payload,
              timestamp: new Date().toISOString()
            });
            break;

          case 'end:giveaway':
            await DatabaseService.endGiveaway(payload.giveawayId);
            io.to(`guild:${guildId}`).emit('realtime:event', {
              type: 'giveaway:ended',
              guildId,
              data: payload,
              timestamp: new Date().toISOString()
            });
            break;
        }

        // Always update stats after actions
        const updatedStats = await DatabaseService.getGuildStats(guildId);
        io.to(`guild:${guildId}`).emit('guild:stats:updated', {
          guildId,
          stats: updatedStats,
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
      const [stats, activity] = await Promise.all([
        DatabaseService.getGuildStats(guildId),
        DatabaseService.getRecentActivity(guildId, 7)
      ]);

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

  // HTTP endpoint for health check
  server.on('request', (req, res) => {
    if (req.url === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthCheck()));
      return;
    }
  });

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

  // Database connection monitoring
  setInterval(async () => {
    try {
      const health = await DatabaseService.healthCheck();
      if (health.status !== 'healthy') {
        console.error('❌ Database health check failed:', health);
        // Emit to all connected clients
        io.emit('system:alert', {
          type: 'database_error',
          message: 'Database connection issues detected',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ Database health check error:', error);
    }
  }, 60000); // Check every minute

});INT', () => {
    console.log('\n🛑 Shutting down dashboard server...');
    io.close(() => {
      console.log('📡 WebSocket server closed');
      server.close(() => {
        console.log('🌐 HTTP server closed');
        process.exit(0);
      });
    });
  });

  process.on('SIG