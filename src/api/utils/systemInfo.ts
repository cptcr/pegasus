import * as si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

export interface GPUInfo {
  vendor: string;
  model: string;
  vram: number;
  temperature: number | null;
  utilization: number | null;
  memoryUtilization: number | null;
  driver?: string;
}

export async function getDetailedSystemInfo() {
  try {
    const [
      osInfo,
      cpuInfo,
      cpuUsage,
      cpuTemp,
      memInfo,
      diskInfo,
      networkInfo,
      networkStats,
      processes,
      dockerInfo,
      services,
    ] = await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.currentLoad(),
      si.cpuTemperature(),
      si.mem(),
      si.fsSize(),
      si.networkInterfaces(),
      si.networkStats(),
      si.processes(),
      si.dockerInfo().catch(() => null),
      si.services('*').catch(() => []),
    ]);

    const gpuInfo = await getGPUInfo();

    return {
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        codename: osInfo.codename,
        kernel: osInfo.kernel,
        arch: osInfo.arch,
        hostname: osInfo.hostname,
        uptime: si.time().uptime,
        timezone: si.time().timezone,
        loadAverage: os.loadavg(),
      },
      cpu: {
        manufacturer: cpuInfo.manufacturer,
        brand: cpuInfo.brand,
        vendor: cpuInfo.vendor,
        family: cpuInfo.family,
        model: cpuInfo.model,
        stepping: cpuInfo.stepping,
        revision: cpuInfo.revision,
        cores: cpuInfo.cores,
        physicalCores: cpuInfo.physicalCores,
        processors: cpuInfo.processors,
        socket: cpuInfo.socket,
        speed: {
          base: cpuInfo.speed,
          min: cpuInfo.speedMin,
          max: cpuInfo.speedMax,
        },
        cache: {
          l1d: cpuInfo.cache.l1d,
          l1i: cpuInfo.cache.l1i,
          l2: cpuInfo.cache.l2,
          l3: cpuInfo.cache.l3,
        },
        temperature: cpuTemp.main || null,
        usage: {
          current: cpuUsage.currentLoad,
          user: cpuUsage.currentLoadUser,
          system: cpuUsage.currentLoadSystem,
          idle: cpuUsage.currentLoadIdle,
          cores: cpuUsage.cpus,
        },
      },
      memory: {
        total: memInfo.total,
        free: memInfo.free,
        used: memInfo.used,
        active: memInfo.active,
        available: memInfo.available,
        buffers: memInfo.buffers,
        cached: memInfo.cached,
        percentage: (memInfo.used / memInfo.total) * 100,
        swap: {
          total: memInfo.swaptotal,
          used: memInfo.swapused,
          free: memInfo.swapfree,
          percentage: memInfo.swaptotal > 0 ? (memInfo.swapused / memInfo.swaptotal) * 100 : 0,
        },
      },
      gpu: gpuInfo,
      disk: diskInfo.map(disk => ({
        filesystem: disk.fs,
        type: disk.type,
        size: disk.size,
        used: disk.used,
        available: disk.available,
        percentage: disk.use,
        mount: disk.mount,
      })),
      network: {
        interfaces: networkInfo.map(iface => ({
          name: iface.iface,
          ip4: iface.ip4,
          ip4subnet: iface.ip4subnet,
          ip6: iface.ip6,
          ip6subnet: iface.ip6subnet,
          mac: iface.mac,
          internal: iface.internal,
          virtual: iface.virtual,
          speed: iface.speed,
          dhcp: iface.dhcp,
          type: iface.type,
          state: iface.operstate,
        })),
        stats:
          networkStats.length > 0
            ? {
                interface: networkStats[0].iface,
                rx: {
                  bytes: networkStats[0].rx_bytes,
                  dropped: networkStats[0].rx_dropped,
                  errors: networkStats[0].rx_errors,
                  perSecond: networkStats[0].rx_sec,
                },
                tx: {
                  bytes: networkStats[0].tx_bytes,
                  dropped: networkStats[0].tx_dropped,
                  errors: networkStats[0].tx_errors,
                  perSecond: networkStats[0].tx_sec,
                },
              }
            : null,
      },
      processes: {
        total: processes.all,
        running: processes.running,
        blocked: processes.blocked,
        sleeping: processes.sleeping,
        list: processes.list.slice(0, 10).map((p: any) => ({
          pid: p.pid,
          name: p.name,
          cpu: p.cpu,
          memory: p.mem,
          state: p.state,
          started: p.started,
        })),
      },
      docker: dockerInfo
        ? {
            containers: dockerInfo.containers,
            containersRunning: dockerInfo.containersRunning,
            containersPaused: dockerInfo.containersPaused,
            containersStopped: dockerInfo.containersStopped,
            images: dockerInfo.images,
            driver: dockerInfo.driver,
            memoryLimit: dockerInfo.memoryLimit,
            swapLimit: dockerInfo.swapLimit,
            kernelMemory: dockerInfo.kernelMemory,
            cpuCfsPeriod: dockerInfo.cpuCfsPeriod,
            cpuCfsQuota: dockerInfo.cpuCfsQuota,
          }
        : null,
      services: services.slice(0, 10).map((s: any) => ({
        name: s.name,
        running: s.running,
        startmode: s.startmode,
        cpu: s.cpu,
        mem: s.mem,
      })),
    };
  } catch (error) {
    throw new Error(`Failed to get system information: ${error}`);
  }
}

async function getGPUInfo(): Promise<GPUInfo[]> {
  try {
    const graphics = await si.graphics();
    const gpus: GPUInfo[] = [];

    for (const controller of graphics.controllers) {
      const gpu: GPUInfo = {
        vendor: controller.vendor || 'Unknown',
        model: controller.model || 'Unknown',
        vram: controller.vram || 0,
        temperature: controller.temperatureGpu || null,
        utilization: controller.utilizationGpu || null,
        memoryUtilization: controller.utilizationMemory || null,
        driver: controller.driverVersion || undefined,
      };

      if (process.platform === 'linux' && controller.vendor.toLowerCase().includes('nvidia')) {
        try {
          const nvidiaSmi = await getNvidiaInfo();
          if (nvidiaSmi) {
            gpu.temperature = nvidiaSmi.temperature;
            gpu.utilization = nvidiaSmi.utilization;
            gpu.memoryUtilization = nvidiaSmi.memoryUtilization;
          }
        } catch {}
      }

      gpus.push(gpu);
    }

    return gpus;
  } catch {
    return [];
  }
}

async function getNvidiaInfo() {
  try {
    const { stdout } = await execAsync(
      'nvidia-smi --query-gpu=temperature.gpu,utilization.gpu,utilization.memory --format=csv,noheader,nounits'
    );

    const [temp, gpuUtil, memUtil] = stdout.trim().split(', ').map(Number);

    return {
      temperature: temp,
      utilization: gpuUtil,
      memoryUtilization: memUtil,
    };
  } catch {
    return null;
  }
}

export async function getProcessInfo(pid: number) {
  try {
    const processes = await si.processes();
    const process = processes.list.find((p: any) => p.pid === pid);

    if (!process) return null;

    return {
      pid: process.pid,
      parentPid: process.parentPid,
      name: process.name,
      cpu: process.cpu,
      cpuUser: process.cpuu,
      cpuSystem: process.cpus,
      memory: process.mem,
      memoryRss: process.memRss,
      memoryVsz: process.memVsz,
      state: process.state,
      priority: process.priority,
      nice: process.nice,
      started: process.started,
      tty: process.tty,
      user: process.user,
      command: process.command,
      params: process.params,
      path: process.path,
    };
  } catch {
    return null;
  }
}
