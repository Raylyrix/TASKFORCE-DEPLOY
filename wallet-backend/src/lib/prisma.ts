import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Support both DATABASE_URL and POSTGRES_URL (Railway provides POSTGRES_URL)
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  logger.error('DATABASE_URL or POSTGRES_URL must be set');
  throw new Error('DATABASE_URL or POSTGRES_URL environment variable is required');
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export { prisma };

