import { Router, Request, Response } from 'express';
import * as si from 'systeminformation';
import { client } from '../../index';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';

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
    const [
      osInfo,
      cpuInfo,
      cpuUsage,
      cpuTemp,
      memInfo,
      gpuInfo,
      diskInfo,
      networkInfo,
      networkStats,
      processes
    ] = await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.currentLoad(),
      si.cpuTemperature(),
      si.mem(),
      si.graphics(),
      si.fsSize(),
      si.networkInterfaces(),
      si.networkStats(),
      si.processes()
    ]);

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

    const botProcess = processes.list.find((p: any) => p.pid === process.pid);
    const botMemory = botProcess ? {
      used: botProcess.memRss,
      total: memInfo.total,
      percentage: (botProcess.memRss / memInfo.total) * 100
    } : {
      used: 0,
      total: memInfo.total,
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
      system: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        arch: osInfo.arch,
        hostname: osInfo.hostname,
        uptime: si.time().uptime,
        loadAverage: cpuUsage.avgLoad ? [cpuUsage.avgLoad] : []
      },
      cpu: {
        manufacturer: cpuInfo.manufacturer,
        brand: cpuInfo.brand,
        cores: cpuInfo.cores,
        physicalCores: cpuInfo.physicalCores,
        speed: cpuInfo.speed,
        temperature: cpuTemp.main || null,
        usage: cpuUsage.currentLoad
      },
      memory: {
        total: memInfo.total,
        free: memInfo.free,
        used: memInfo.used,
        percentage: (memInfo.used / memInfo.total) * 100,
        swap: {
          total: memInfo.swaptotal,
          used: memInfo.swapused,
          free: memInfo.swapfree
        }
      },
      gpu: gpuInfo.controllers.map(gpu => ({
        vendor: gpu.vendor,
        model: gpu.model,
        vram: gpu.vram || 0,
        temperature: gpu.temperatureGpu || null,
        utilizationGpu: gpu.utilizationGpu || null,
        utilizationMemory: gpu.utilizationMemory || null
      })),
      disk: diskInfo.map(disk => ({
        filesystem: disk.fs,
        size: disk.size,
        used: disk.used,
        available: disk.available,
        use: disk.use,
        mount: disk.mount
      })),
      network: {
        interfaces: networkInfo.map(iface => ({
          iface: iface.iface,
          ip4: iface.ip4,
          ip6: iface.ip6,
          mac: iface.mac,
          speed: iface.speed
        })),
        stats: networkStats[0] ? {
          rx_bytes: networkStats[0].rx_bytes,
          tx_bytes: networkStats[0].tx_bytes,
          rx_sec: networkStats[0].rx_sec,
          tx_sec: networkStats[0].tx_sec
        } : {
          rx_bytes: 0,
          tx_bytes: 0,
          rx_sec: 0,
          tx_sec: 0
        }
      },
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