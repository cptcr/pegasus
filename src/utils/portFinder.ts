import { createServer } from 'net';
import { logger } from './logger';

export async function findAvailablePort(startPort: number = 2000, endPort: number = 9000): Promise<number> {
  for (let port = startPort; port <= endPort; port++) {
    const isAvailable = await checkPortAvailability(port);
    if (isAvailable) {
      logger.info(`Found available port: ${port}`);
      return port;
    }
  }
  
  throw new Error(`No available ports found in range ${startPort}-${endPort}`);
}

async function checkPortAvailability(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, '0.0.0.0');
  });
}

export async function getNextAvailablePort(): Promise<number> {
  try {
    const port = await findAvailablePort();
    return port;
  } catch (error) {
    logger.error('Failed to find available port', error as Error);
    throw error;
  }
}