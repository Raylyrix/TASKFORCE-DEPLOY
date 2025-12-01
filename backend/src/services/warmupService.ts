import { PrismaClient } from '@prisma/client';
import { getSendingLimits } from './reputationService';

const prisma = new PrismaClient();

/**
 * Start warm-up process for a domain
 */
export async function startWarmup(sendingDomainId: string) {
  // Check if warm-up already started
  const existing = await prisma.domainReputation.findUnique({
    where: { sendingDomainId },
  });

  if (existing?.isInWarmup) {
    return existing;
  }

  // Mark as in warm-up
  await prisma.domainReputation.update({
    where: { sendingDomainId },
    data: {
      isInWarmup: true,
      warmupStartedAt: new Date(),
    },
  });

  // Create first warm-up day
  await prisma.emailWarmup.create({
    data: {
      sendingDomainId,
      day: 1,
      targetVolume: 50,
    },
  });

  return true;
}

/**
 * Complete a warm-up day
 */
export async function completeWarmupDay(sendingDomainId: string, day: number, actualVolume: number) {
  await prisma.emailWarmup.updateMany({
    where: {
      sendingDomainId,
      day,
    },
    data: {
      actualVolume,
      completedAt: new Date(),
    },
  });

  // Check if we should continue warm-up
  const warmups = await prisma.emailWarmup.findMany({
    where: { sendingDomainId },
    orderBy: { day: 'desc' },
    take: 1,
  });

  if (warmups.length === 0) return;

  const lastWarmup = warmups[0];
  const nextDay = lastWarmup.day + 1;

  // Continue warm-up for up to 30 days
  if (nextDay <= 30) {
    const nextTarget = Math.floor(lastWarmup.targetVolume * 1.5);
    await prisma.emailWarmup.create({
      data: {
        sendingDomainId,
        day: nextDay,
        targetVolume: Math.min(nextTarget, 10000), // Cap at 10k
      },
    });
  } else {
    // Warm-up complete
    await prisma.domainReputation.update({
      where: { sendingDomainId },
      data: {
        isInWarmup: false,
      },
    });
  }
}

/**
 * Get current warm-up status
 */
export async function getWarmupStatus(sendingDomainId: string) {
  const sendingDomain = await prisma.sendingDomain.findUnique({
    where: { id: sendingDomainId },
    include: {
      reputation: true,
      warmups: {
        orderBy: { day: 'asc' },
      },
    },
  });

  if (!sendingDomain || !sendingDomain.reputation) {
    return null;
  }

  const isInWarmup = sendingDomain.reputation.isInWarmup;
  const currentDay = sendingDomain.warmups.length;
  const limits = await getSendingLimits(sendingDomainId);

  return {
    isInWarmup,
    currentDay,
    dailyLimit: limits.dailyLimit,
    hourlyLimit: limits.hourlyLimit,
    warmups: sendingDomain.warmups,
  };
}

/**
 * Check if domain can send based on warm-up status
 */
export async function canSendEmail(sendingDomainId: string, requestedCount: number = 1): Promise<{
  canSend: boolean;
  reason?: string;
  dailyLimit?: number;
  hourlyLimit?: number;
}> {
  const limits = await getSendingLimits(sendingDomainId);

  // Check daily limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Count emails sent today (this would need to be tracked)
  // For now, we'll use a simplified check
  const sendingDomain = await prisma.sendingDomain.findUnique({
    where: { id: sendingDomainId },
    include: {
      reputation: true,
    },
  });

  if (!sendingDomain) {
    return {
      canSend: false,
      reason: 'Domain not found',
    };
  }

  // If in warm-up, check current day's progress
  if (sendingDomain.reputation?.isInWarmup) {
    const warmup = await prisma.emailWarmup.findFirst({
      where: {
        sendingDomainId,
        completedAt: null,
      },
      orderBy: { day: 'desc' },
    });

    if (warmup) {
      const remaining = warmup.targetVolume - warmup.actualVolume;
      if (requestedCount > remaining) {
        return {
          canSend: false,
          reason: `Warm-up limit reached for day ${warmup.day}. Remaining: ${remaining}`,
          dailyLimit: warmup.targetVolume,
        };
      }
    }
  }

  return {
    canSend: true,
    dailyLimit: limits.dailyLimit,
    hourlyLimit: limits.hourlyLimit,
  };
}




