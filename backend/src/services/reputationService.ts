import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Calculate and update domain reputation
 */
export async function calculateReputation(sendingDomainId: string) {
  const sendingDomain = await prisma.sendingDomain.findUnique({
    where: { id: sendingDomainId },
    include: {
      reputation: true,
      bounces: {
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      },
      complaints: {
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      },
    },
  });

  if (!sendingDomain || !sendingDomain.reputation) {
    return null;
  }

  const reputation = sendingDomain.reputation;
  
  // Get message stats from last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // This would ideally come from MessageLog aggregated data
  // For now, we'll use the reputation record's existing counts
  
  const totalSent = reputation.totalSent || 0;
  const totalDelivered = reputation.totalDelivered || 0;
  const totalBounced = sendingDomain.bounces.length;
  const totalComplained = sendingDomain.complaints.length;
  const totalOpened = reputation.totalOpened || 0;
  const totalClicked = reputation.totalClicked || 0;

  // Calculate rates
  const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
  const complaintRate = totalSent > 0 ? (totalComplained / totalSent) * 100 : 0;
  const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
  const clickRate = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0;

  // Calculate reputation score (0-100)
  let reputationScore = 100;

  // Penalize high bounce rates
  if (bounceRate > 5) {
    reputationScore = Math.max(0, reputationScore - 50);
  } else if (bounceRate > 2) {
    reputationScore = Math.max(0, reputationScore - 25);
  } else if (bounceRate > 1) {
    reputationScore = Math.max(0, reputationScore - 10);
  }

  // Penalize high complaint rates (very bad)
  if (complaintRate > 0.5) {
    reputationScore = Math.max(0, reputationScore - 40);
  } else if (complaintRate > 0.1) {
    reputationScore = Math.max(0, reputationScore - 20);
  } else if (complaintRate > 0.05) {
    reputationScore = Math.max(0, reputationScore - 10);
  }

  // Reward good engagement
  if (openRate > 30) {
    reputationScore = Math.min(100, reputationScore + 5);
  }
  if (clickRate > 5) {
    reputationScore = Math.min(100, reputationScore + 5);
  }

  // Update reputation
  const updated = await prisma.domainReputation.update({
    where: { sendingDomainId },
    data: {
      bounceRate,
      complaintRate,
      openRate,
      clickRate,
      totalBounced,
      totalComplained,
      reputationScore,
      lastCalculatedAt: new Date(),
    },
  });

  return updated;
}

/**
 * Record email sent
 */
export async function recordEmailSent(sendingDomainId: string) {
  const reputation = await prisma.domainReputation.findUnique({
    where: { sendingDomainId },
  });

  if (!reputation) {
    // Create reputation if it doesn't exist
    await prisma.domainReputation.create({
      data: {
        sendingDomainId,
        totalSent: 1,
        totalDelivered: 1,
      },
    });
    return;
  }

  await prisma.domainReputation.update({
    where: { sendingDomainId },
    data: {
      totalSent: reputation.totalSent + 1,
      totalDelivered: reputation.totalDelivered + 1,
    },
  });
}

/**
 * Record email delivered
 */
export async function recordEmailDelivered(sendingDomainId: string) {
  const reputation = await prisma.domainReputation.findUnique({
    where: { sendingDomainId },
  });

  if (!reputation) return;

  await prisma.domainReputation.update({
    where: { sendingDomainId },
    data: {
      totalDelivered: reputation.totalDelivered + 1,
    },
  });
}

/**
 * Record email opened
 */
export async function recordEmailOpened(sendingDomainId: string) {
  const reputation = await prisma.domainReputation.findUnique({
    where: { sendingDomainId },
  });

  if (!reputation) return;

  await prisma.domainReputation.update({
    where: { sendingDomainId },
    data: {
      totalOpened: reputation.totalOpened + 1,
    },
  });
}

/**
 * Record email clicked
 */
export async function recordEmailClicked(sendingDomainId: string) {
  const reputation = await prisma.domainReputation.findUnique({
    where: { sendingDomainId },
  });

  if (!reputation) return;

  await prisma.domainReputation.update({
    where: { sendingDomainId },
    data: {
      totalClicked: reputation.totalClicked + 1,
    },
  });
}

/**
 * Record spam complaint
 */
export async function recordComplaint(
  sendingDomainId: string,
  recipientEmail: string,
  messageLogId?: string,
  feedbackType?: string
) {
  await prisma.emailComplaint.create({
    data: {
      sendingDomainId,
      recipientEmail,
      messageLogId,
      feedbackType,
    },
  });

  // Update reputation
  await calculateReputation(sendingDomainId);
}

/**
 * Check if domain is in good standing
 */
export async function isDomainInGoodStanding(sendingDomainId: string): Promise<boolean> {
  const reputation = await prisma.domainReputation.findUnique({
    where: { sendingDomainId },
  });

  if (!reputation) return true; // New domain, assume good

  // Check bounce rate
  if (reputation.bounceRate > 5) return false;

  // Check complaint rate
  if (reputation.complaintRate > 0.5) return false;

  // Check reputation score
  if (reputation.reputationScore < 50) return false;

  return true;
}

/**
 * Get sending limits based on reputation and warm-up status
 */
export async function getSendingLimits(sendingDomainId: string): Promise<{
  dailyLimit: number;
  hourlyLimit: number;
  isInWarmup: boolean;
}> {
  const sendingDomain = await prisma.sendingDomain.findUnique({
    where: { id: sendingDomainId },
    include: { reputation: true, warmups: true },
  });

  if (!sendingDomain || !sendingDomain.reputation) {
    // New domain - start with warm-up limits
    return {
      dailyLimit: 50,
      hourlyLimit: 5,
      isInWarmup: true,
    };
  }

  const isInWarmup = sendingDomain.reputation.isInWarmup;
  const reputationScore = sendingDomain.reputation.reputationScore;

  if (isInWarmup) {
    // Warm-up phase - gradual increase
    const warmupDays = sendingDomain.warmups.length;
    const baseLimit = 50;
    const dailyLimit = Math.min(10000, baseLimit * Math.pow(1.5, warmupDays));
    
    return {
      dailyLimit: Math.floor(dailyLimit),
      hourlyLimit: Math.floor(dailyLimit / 24),
      isInWarmup: true,
    };
  }

  // Mature domain - limits based on reputation
  let dailyLimit = 10000; // Default
  if (reputationScore < 50) {
    dailyLimit = 100;
  } else if (reputationScore < 75) {
    dailyLimit = 1000;
  } else if (reputationScore < 90) {
    dailyLimit = 5000;
  }

  return {
    dailyLimit,
    hourlyLimit: Math.floor(dailyLimit / 24),
    isInWarmup: false,
  };
}




