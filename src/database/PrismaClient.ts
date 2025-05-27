// src/database/PrismaClient.ts - Version-Compatible Prisma Client Configuration
import { PrismaClient } from '@prisma/client';

export const createPrismaClient = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error'] 
      : ['error'],
    errorFormat: 'pretty',
    // Explicitly set datasources to avoid issues
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  // No need for event handler as we'll handle disconnection explicitly
  return client;
};

// Export a singleton instance
let prismaInstance: PrismaClient | null = null;

export const prisma = (() => {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();
  }
  return prismaInstance;
})();

// Graceful shutdown handler for Prisma
export const disconnectPrisma = async () => {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
};