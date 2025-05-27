// src/database/PrismaClient.ts - Optimized Prisma Configuration to Reduce Query Spam
import { PrismaClient } from '@prisma/client';

export const createPrismaClient = () => {
  const client = new PrismaClient({
    // Reduce logging to only errors in production
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] // Removed 'query' and 'info' to reduce spam
      : ['error'],
    errorFormat: 'minimal', // Use minimal format instead of pretty
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  return client;
};

// Export a singleton instance with connection pooling optimization
let prismaInstance: PrismaClient | null = null;

export const prisma = (() => {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();
    
    // Add connection optimization
    prismaInstance.$connect().then(() => {
      console.log('✅ Database connected with optimized settings');
    }).catch((error) => {
      console.error('❌ Database connection failed:', error);
    });
  }
  return prismaInstance;
})();

// Graceful shutdown handler for Prisma
export const disconnectPrisma = async () => {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    console.log('🔌 Database disconnected gracefully');
  }
};