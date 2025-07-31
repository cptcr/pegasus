import express from 'express';
import { database } from '../database/connection';
import { metricsCollector } from '../utils/metrics';
import { logger } from '../utils/logger';
import { config } from '../config';
import { rateLimiter } from '../security/rateLimiter';
import { Client } from 'discord.js';

export class MonitoringDashboard {
  private app: express.Application;
  private port: number;
  private client: Client;

  constructor(client: Client, port: number = 3001) {
    this.app = express();
    this.port = port;
    this.client = client;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Enable CORS for local development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    // Dashboard HTML
    this.app.get('/', (req, res) => {
      res.send(this.getDashboardHTML());
    });

    // API endpoints
    this.app.get('/api/stats', async (req, res) => {
      try {
        const stats = await this.getStats();
        res.json(stats);
      } catch (error) {
        logger.error('Failed to get stats', error as Error);
        res.status(500).json({ error: 'Failed to get stats' });
      }
    });

    this.app.get('/api/metrics', (req, res) => {
      const metrics = metricsCollector.getMetrics();
      res.json(metrics);
    });

    this.app.get('/api/logs', async (req, res) => {
      try {
        const logs = await this.getRecentLogs();
        res.json(logs);
      } catch (error) {
        logger.error('Failed to get logs', error as Error);
        res.status(500).json({ error: 'Failed to get logs' });
      }
    });

    this.app.get('/api/health', async (req, res) => {
      try {
        const health = await this.getHealthStatus();
        res.json(health);
      } catch (error) {
        logger.error('Failed to get health status', error as Error);
        res.status(500).json({ error: 'Failed to get health status' });
      }
    });
  }

  async start(): Promise<void> {
    this.app.listen(this.port, () => {
      logger.info(`Monitoring dashboard started on port ${this.port}`);
    });
  }

  private async getStats(): Promise<any> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Bot stats
    const guildCount = this.client.guilds.cache.size;
    const userCount = this.client.users.cache.size;
    const channelCount = this.client.channels.cache.size;
    const uptime = process.uptime();

    // Database stats
    const dbStats = await database.query(`
      SELECT 
        (SELECT COUNT(*) FROM guilds) as guilds,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM guild_stats) as tracked_guilds,
        (SELECT COUNT(*) FROM economy) as economy_users,
        (SELECT COUNT(*) FROM tickets WHERE status = 'open') as open_tickets,
        (SELECT COUNT(*) FROM giveaways WHERE status = 'active') as active_giveaways
    `);

    // Activity stats
    const activityStats = await database.query(`
      SELECT 
        (SELECT COUNT(*) FROM audit_logs WHERE created_at > $1) as daily_actions,
        (SELECT COUNT(*) FROM audit_logs WHERE created_at > $2) as weekly_actions,
        (SELECT COUNT(DISTINCT user_id) FROM audit_logs WHERE created_at > $1) as daily_active_users,
        (SELECT COUNT(DISTINCT guild_id) FROM audit_logs WHERE created_at > $1) as daily_active_guilds
    `, [oneDayAgo, oneWeekAgo]);

    // Command stats
    const commandStats = await database.query(`
      SELECT command, COUNT(*) as count
      FROM audit_logs
      WHERE action = 'command_executed' AND created_at > $1
      GROUP BY command
      ORDER BY count DESC
      LIMIT 10
    `, [oneDayAgo]);

    // Rate limit stats
    const rateLimitStats = rateLimiter.getMetrics();

    return {
      bot: {
        guilds: guildCount,
        users: userCount,
        channels: channelCount,
        uptime: Math.floor(uptime),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      database: dbStats.rows[0],
      activity: activityStats.rows[0],
      topCommands: commandStats.rows,
      rateLimit: rateLimitStats
    };
  }

  private async getRecentLogs(): Promise<any[]> {
    const result = await database.query(`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 100
    `);

    return result.rows;
  }

  private async getHealthStatus(): Promise<any> {
    const checks = {
      bot: false,
      database: false,
      redis: false,
      memory: false
    };

    // Bot check
    checks.bot = this.client.ws.ping > 0;

    // Database check
    try {
      await database.query('SELECT 1');
      checks.database = true;
    } catch {
      checks.database = false;
    }

    // Memory check
    const memUsage = process.memoryUsage();
    checks.memory = memUsage.heapUsed / memUsage.heapTotal < 0.9;

    const allHealthy = Object.values(checks).every(v => v);

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks,
      timestamp: new Date().toISOString()
    };
  }

  private getDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pegasus Bot - Monitoring Dashboard</title>
    <style>
        :root {
            --bg-primary: #0f0f0f;
            --bg-secondary: #1a1a1a;
            --bg-tertiary: #252525;
            --text-primary: #ffffff;
            --text-secondary: #a0a0a0;
            --accent: #0099ff;
            --success: #00ff00;
            --warning: #ffff00;
            --error: #ff0000;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            background: var(--bg-secondary);
            padding: 20px 0;
            margin-bottom: 30px;
            border-bottom: 2px solid var(--accent);
        }

        h1 {
            text-align: center;
            color: var(--accent);
            font-size: 2.5em;
        }

        .status-bar {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 10px;
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.9em;
        }

        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--success);
        }

        .status-dot.unhealthy {
            background: var(--error);
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .metric-card {
            background: var(--bg-secondary);
            border: 1px solid var(--bg-tertiary);
            border-radius: 8px;
            padding: 20px;
            transition: transform 0.2s;
        }

        .metric-card:hover {
            transform: translateY(-2px);
            border-color: var(--accent);
        }

        .metric-card h3 {
            color: var(--accent);
            margin-bottom: 15px;
            font-size: 1.2em;
        }

        .metric-value {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .metric-label {
            color: var(--text-secondary);
            font-size: 0.9em;
        }

        .charts-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .chart-card {
            background: var(--bg-secondary);
            border: 1px solid var(--bg-tertiary);
            border-radius: 8px;
            padding: 20px;
        }

        .chart-card h3 {
            color: var(--accent);
            margin-bottom: 15px;
        }

        .logs-container {
            background: var(--bg-secondary);
            border: 1px solid var(--bg-tertiary);
            border-radius: 8px;
            padding: 20px;
        }

        .logs-container h3 {
            color: var(--accent);
            margin-bottom: 15px;
        }

        .log-entry {
            background: var(--bg-tertiary);
            padding: 10px;
            margin-bottom: 5px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.85em;
        }

        .log-entry.error {
            border-left: 3px solid var(--error);
        }

        .log-entry.warning {
            border-left: 3px solid var(--warning);
        }

        .log-entry.info {
            border-left: 3px solid var(--accent);
        }

        .refresh-btn {
            background: var(--accent);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1em;
            transition: opacity 0.2s;
        }

        .refresh-btn:hover {
            opacity: 0.8;
        }

        .refresh-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: var(--text-secondary);
        }

        .error-message {
            background: rgba(255, 0, 0, 0.1);
            border: 1px solid var(--error);
            color: var(--error);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <header>
        <div class="container">
            <h1>Pegasus Bot - Monitoring Dashboard</h1>
            <div class="status-bar" id="statusBar">
                <div class="status-indicator">
                    <div class="status-dot" id="botStatus"></div>
                    <span>Bot</span>
                </div>
                <div class="status-indicator">
                    <div class="status-dot" id="dbStatus"></div>
                    <span>Database</span>
                </div>
                <div class="status-indicator">
                    <div class="status-dot" id="memoryStatus"></div>
                    <span>Memory</span>
                </div>
            </div>
        </div>
    </header>

    <div class="container">
        <div style="text-align: right; margin-bottom: 20px;">
            <button class="refresh-btn" onclick="refreshData()">Refresh Data</button>
        </div>

        <div class="metrics-grid" id="metricsGrid">
            <div class="loading">Loading metrics...</div>
        </div>

        <div class="charts-container">
            <div class="chart-card">
                <h3>Top Commands (24h)</h3>
                <canvas id="commandsChart" width="400" height="200"></canvas>
            </div>
            <div class="chart-card">
                <h3>Activity Timeline</h3>
                <canvas id="activityChart" width="400" height="200"></canvas>
            </div>
        </div>

        <div class="logs-container">
            <h3>Recent Activity</h3>
            <div id="logsContainer">
                <div class="loading">Loading logs...</div>
            </div>
        </div>
    </div>

    <script>
        let refreshInterval;

        async function fetchData(endpoint) {
            try {
                const response = await fetch(\`/api/\${endpoint}\`);
                if (!response.ok) throw new Error('Failed to fetch');
                return await response.json();
            } catch (error) {
                console.error(\`Error fetching \${endpoint}:\`, error);
                return null;
            }
        }

        async function updateDashboard() {
            // Fetch all data
            const [stats, health, logs] = await Promise.all([
                fetchData('stats'),
                fetchData('health'),
                fetchData('logs')
            ]);

            // Update status indicators
            if (health) {
                document.getElementById('botStatus').className = \`status-dot \${health.checks.bot ? '' : 'unhealthy'}\`;
                document.getElementById('dbStatus').className = \`status-dot \${health.checks.database ? '' : 'unhealthy'}\`;
                document.getElementById('memoryStatus').className = \`status-dot \${health.checks.memory ? '' : 'unhealthy'}\`;
            }

            // Update metrics
            if (stats) {
                const metricsGrid = document.getElementById('metricsGrid');
                metricsGrid.innerHTML = \`
                    <div class="metric-card">
                        <h3>Bot Statistics</h3>
                        <div class="metric-value">\${stats.bot.guilds.toLocaleString()}</div>
                        <div class="metric-label">Guilds</div>
                        <div class="metric-value">\${stats.bot.users.toLocaleString()}</div>
                        <div class="metric-label">Users</div>
                        <div class="metric-value">\${formatUptime(stats.bot.uptime)}</div>
                        <div class="metric-label">Uptime</div>
                    </div>
                    <div class="metric-card">
                        <h3>Database</h3>
                        <div class="metric-value">\${stats.database.tracked_guilds}</div>
                        <div class="metric-label">Tracked Guilds</div>
                        <div class="metric-value">\${stats.database.open_tickets}</div>
                        <div class="metric-label">Open Tickets</div>
                        <div class="metric-value">\${stats.database.active_giveaways}</div>
                        <div class="metric-label">Active Giveaways</div>
                    </div>
                    <div class="metric-card">
                        <h3>Activity (24h)</h3>
                        <div class="metric-value">\${stats.activity.daily_actions.toLocaleString()}</div>
                        <div class="metric-label">Total Actions</div>
                        <div class="metric-value">\${stats.activity.daily_active_users.toLocaleString()}</div>
                        <div class="metric-label">Active Users</div>
                        <div class="metric-value">\${stats.activity.daily_active_guilds.toLocaleString()}</div>
                        <div class="metric-label">Active Guilds</div>
                    </div>
                    <div class="metric-card">
                        <h3>System Resources</h3>
                        <div class="metric-value">\${Math.round(stats.bot.memory.heapUsed / 1024 / 1024)} MB</div>
                        <div class="metric-label">Memory Usage</div>
                        <div class="metric-value">\${stats.rateLimit.totalEntries}</div>
                        <div class="metric-label">Rate Limited Users</div>
                        <div class="metric-value">\${stats.rateLimit.blacklistedCount}</div>
                        <div class="metric-label">Blacklisted</div>
                    </div>
                \`;

                // Update command chart
                updateCommandChart(stats.topCommands);
            }

            // Update logs
            if (logs) {
                const logsContainer = document.getElementById('logsContainer');
                logsContainer.innerHTML = logs.slice(0, 20).map(log => {
                    const time = new Date(log.created_at).toLocaleString();
                    const severity = log.category === 'security' ? 'error' : 
                                   log.category === 'moderation' ? 'warning' : 'info';
                    return \`
                        <div class="log-entry \${severity}">
                            <strong>\${time}</strong> - 
                            [\${log.category}] \${log.action} - 
                            User: \${log.user_id} - 
                            Guild: \${log.guild_id}
                        </div>
                    \`;
                }).join('');
            }
        }

        function formatUptime(seconds) {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            
            const parts = [];
            if (days > 0) parts.push(\`\${days}d\`);
            if (hours > 0) parts.push(\`\${hours}h\`);
            if (minutes > 0) parts.push(\`\${minutes}m\`);
            
            return parts.join(' ') || '0m';
        }

        function updateCommandChart(commands) {
            const canvas = document.getElementById('commandsChart');
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (!commands || commands.length === 0) return;
            
            const maxCount = Math.max(...commands.map(c => c.count));
            const barWidth = canvas.width / commands.length;
            const barGap = 10;
            
            commands.forEach((cmd, index) => {
                const barHeight = (cmd.count / maxCount) * (canvas.height - 40);
                const x = index * barWidth + barGap / 2;
                const y = canvas.height - barHeight - 20;
                
                // Draw bar
                ctx.fillStyle = '#0099ff';
                ctx.fillRect(x, y, barWidth - barGap, barHeight);
                
                // Draw label
                ctx.fillStyle = '#ffffff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(cmd.command, x + (barWidth - barGap) / 2, canvas.height - 5);
                
                // Draw count
                ctx.fillText(cmd.count.toString(), x + (barWidth - barGap) / 2, y - 5);
            });
        }

        async function refreshData() {
            const btn = document.querySelector('.refresh-btn');
            btn.disabled = true;
            btn.textContent = 'Refreshing...';
            
            await updateDashboard();
            
            btn.disabled = false;
            btn.textContent = 'Refresh Data';
        }

        // Initial load
        updateDashboard();

        // Auto-refresh every 30 seconds
        refreshInterval = setInterval(updateDashboard, 30000);

        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            clearInterval(refreshInterval);
        });
    </script>
</body>
</html>
    `;
  }
}

// Export for use in main bot file
export function setupMonitoring(client: Client): MonitoringDashboard {
  const dashboard = new MonitoringDashboard(client);
  return dashboard;
}