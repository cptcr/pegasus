import { Router, Request, Response } from 'express';
import { client } from '../../index';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { getDetailedSystemInfo, getProcessInfo } from '../utils/systemInfo';

const router = Router();

interface SystemStatus {
  bot: {
    username: string | null;
    id: string | null;
    status: string;
    uptime: number;
    guilds: number;
    users: number;
    channels: number;
    commands: number;
    ping: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  system: {
    platform: string;
    distro: string;
    release: string;
    arch: string;
    hostname: string;
    uptime: number;
    loadAverage: number[];
  };
  cpu: {
    manufacturer: string;
    brand: string;
    cores: number;
    physicalCores: number;
    speed: number;
    temperature: number | null;
    usage: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    percentage: number;
    swap: {
      total: number;
      used: number;
      free: number;
    };
  };
  gpu: Array<{
    vendor: string;
    model: string;
    vram: number;
    temperature: number | null;
    utilizationGpu: number | null;
    utilizationMemory: number | null;
  }>;
  disk: Array<{
    filesystem: string;
    size: number;
    used: number;
    available: number;
    use: number;
    mount: string;
  }>;
  network: {
    interfaces: Array<{
      iface: string;
      ip4: string;
      ip6: string;
      mac: string;
      speed: number | null;
    }>;
    stats: {
      rx_bytes: number;
      tx_bytes: number;
      rx_sec: number;
      tx_sec: number;
    };
  };
  services: {
    discord: {
      connected: boolean;
      latency: number;
      shards: Array<{
        id: number;
        status: string;
        ping: number;
      }>;
    };
    database: {
      connected: boolean;
      latency: number;
      pool: {
        total: number;
        idle: number;
        waiting: number;
      };
    };
    apis: {
      steam: {
        available: boolean;
        latency: number | null;
      };
      weather: {
        available: boolean;
        latency: number | null;
      };
      news: {
        available: boolean;
        latency: number | null;
      };
    };
  };
  timestamp: string;
}

async function getDatabaseLatency(): Promise<number> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return Date.now() - start;
  } catch (error) {
    logger.error('Database ping failed:', error);
    return -1;
  }
}

async function getApiLatency(url: string): Promise<number | null> {
  if (!url) return null;
  
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    await fetch(url, { 
      signal: controller.signal,
      method: 'HEAD'
    });
    
    clearTimeout(timeout);
    return Date.now() - start;
  } catch {
    return null;
  }
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const systemInfo = await getDetailedSystemInfo();
    const botProcess = await getProcessInfo(process.pid);

    const dbLatency = await getDatabaseLatency();
    
    const steamLatency = process.env.STEAM_API_KEY 
      ? await getApiLatency('https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/')
      : null;
    
    const weatherLatency = process.env.WEATHER_API_KEY
      ? await getApiLatency('https://api.openweathermap.org/data/2.5/weather?q=London')
      : null;
      
    const newsLatency = process.env.NEWS_API_KEY
      ? await getApiLatency('https://newsapi.org/v2/top-headlines?country=us')
      : null;

    const botMemory = botProcess ? {
      used: botProcess.memoryRss || 0,
      total: systemInfo.memory.total,
      percentage: botProcess.memoryRss ? (botProcess.memoryRss / systemInfo.memory.total) * 100 : 0
    } : {
      used: 0,
      total: systemInfo.memory.total,
      percentage: 0
    };

    const guilds = client.guilds.cache;
    const totalUsers = guilds.reduce((acc, guild) => acc + guild.memberCount, 0);
    const totalChannels = guilds.reduce((acc, guild) => acc + guild.channels.cache.size, 0);

    const status: SystemStatus = {
      bot: {
        username: client.user?.username || null,
        id: client.user?.id || null,
        status: client.user ? 'online' : 'offline',
        uptime: client.uptime || 0,
        guilds: guilds.size,
        users: totalUsers,
        channels: totalChannels,
        commands: client.commands?.size || 0,
        ping: client.ws.ping,
        memory: botMemory
      },
      system: systemInfo.os,
      cpu: systemInfo.cpu,
      memory: systemInfo.memory,
      gpu: systemInfo.gpu,
      disk: systemInfo.disk,
      network: systemInfo.network,
      processes: systemInfo.processes,
      docker: systemInfo.docker,
      services: {
        discord: {
          connected: client.ws.status === 0,
          latency: client.ws.ping,
          shards: Array.from(client.ws.shards.values()).map(shard => ({
            id: shard.id,
            status: ['READY', 'CONNECTING', 'RECONNECTING', 'IDLE', 'NEARLY', 'DISCONNECTED', 'WAITING_FOR_GUILDS', 'IDENTIFYING', 'RESUMING'][shard.status],
            ping: shard.ping
          }))
        },
        database: {
          connected: dbLatency >= 0,
          latency: dbLatency,
          pool: {
            total: 20,
            idle: 0,
            waiting: 0
          }
        },
        apis: {
          steam: {
            available: !!process.env.STEAM_API_KEY,
            latency: steamLatency
          },
          weather: {
            available: !!process.env.WEATHER_API_KEY,
            latency: weatherLatency
          },
          news: {
            available: !!process.env.NEWS_API_KEY,
            latency: newsLatency
          }
        }
      },
      timestamp: new Date().toISOString()
    };

    res.json(status);
  } catch (error) {
    logger.error('Error fetching system status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch system status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as statusRouter };