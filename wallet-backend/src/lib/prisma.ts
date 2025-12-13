import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

let prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  // Support both DATABASE_URL and POSTGRES_URL (Railway provides POSTGRES_URL)
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl || databaseUrl.trim() === '' || databaseUrl.includes('${{')) {
    logger.warn('DATABASE_URL or POSTGRES_URL not set or unresolved');
    // Create a client anyway - it will fail on first use, but allows server to start
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  } else {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }

  // Graceful shutdown
  process.on('beforeExit', async () => {
    if (prismaInstance) {
      await prismaInstance.$disconnect();
    }
  });

  return prismaInstance;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return getPrismaClient()[prop as keyof PrismaClient];
  },
});

export { prisma };

