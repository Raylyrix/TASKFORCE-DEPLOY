import { PrismaClient, BounceType, BounceCategory } from '@prisma/client';

const prisma = new PrismaClient();

export interface BounceData {
  recipientEmail: string;
  bounceType: BounceType;
  bounceCategory: BounceCategory;
  reason?: string;
  rawResponse?: string;
  messageLogId?: string;
  sendingDomainId?: string;
}

/**
 * Record a bounce event
 */
export async function recordBounce(data: BounceData) {
  const bounce = await prisma.emailBounce.create({
    data: {
      recipientEmail: data.recipientEmail,
      bounceType: data.bounceType,
      bounceCategory: data.bounceCategory,
      reason: data.reason,
      rawResponse: data.rawResponse,
      messageLogId: data.messageLogId,
      sendingDomainId: data.sendingDomainId,
    },
  });

  // Update domain reputation
  if (data.sendingDomainId) {
    await updateReputationAfterBounce(data.sendingDomainId, data.bounceType);
  }

  // Mark recipient as undeliverable if hard bounce
  if (data.bounceType === BounceType.HARD && data.messageLogId) {
    const messageLog = await prisma.messageLog.findUnique({
      where: { id: data.messageLogId },
      include: { recipient: true },
    });

    if (messageLog?.recipient) {
      await prisma.campaignRecipient.update({
        where: { id: messageLog.recipient.id },
        data: {
          status: 'SUPPRESSED', // Use SUPPRESSED for bounced emails // Assuming this status exists
        },
      });
    }
  }

  return bounce;
}

/**
 * Update domain reputation after bounce
 */
async function updateReputationAfterBounce(sendingDomainId: string, bounceType: BounceType) {
  const reputation = await prisma.domainReputation.findUnique({
    where: { sendingDomainId },
  });

  if (!reputation) return;

  const totalBounced = reputation.totalBounced + 1;
  const totalSent = reputation.totalSent || 1;
  const bounceRate = (totalBounced / totalSent) * 100;

  // Calculate reputation score (0-100)
  // Lower score for higher bounce rates
  let reputationScore = 100;
  if (bounceRate > 5) reputationScore = 50;
  else if (bounceRate > 2) reputationScore = 75;
  else if (bounceRate > 1) reputationScore = 90;

  // Penalize hard bounces more
  if (bounceType === BounceType.HARD) {
    reputationScore = Math.max(0, reputationScore - 10);
  }

  await prisma.domainReputation.update({
    where: { sendingDomainId },
    data: {
      totalBounced,
      bounceRate,
      reputationScore,
      lastCalculatedAt: new Date(),
    },
  });
}

/**
 * Check if email should be suppressed (too many bounces)
 */
export async function shouldSuppressEmail(email: string, sendingDomainId?: string): Promise<boolean> {
  const where: any = { recipientEmail: email };
  if (sendingDomainId) {
    where.sendingDomainId = sendingDomainId;
  }

  const hardBounces = await prisma.emailBounce.count({
    where: {
      ...where,
      bounceType: BounceType.HARD,
    },
  });

  // Suppress after 1 hard bounce
  if (hardBounces >= 1) {
    return true;
  }

  const softBounces = await prisma.emailBounce.count({
    where: {
      ...where,
      bounceType: BounceType.SOFT,
    },
  });

  // Suppress after 3 soft bounces
  if (softBounces >= 3) {
    return true;
  }

  return false;
}

/**
 * Parse bounce from Gmail error response
 */
export function parseBounceFromError(error: string): {
  bounceType: BounceType;
  bounceCategory: BounceCategory;
  reason?: string;
} {
  const errorLower = error.toLowerCase();

  // Hard bounces
  if (
    errorLower.includes('invalid') ||
    errorLower.includes('does not exist') ||
    errorLower.includes('no such user') ||
    errorLower.includes('user unknown') ||
    errorLower.includes('address rejected')
  ) {
    return {
      bounceType: BounceType.HARD,
      bounceCategory: BounceCategory.INVALID_EMAIL,
      reason: error,
    };
  }

  // Soft bounces
  if (
    errorLower.includes('mailbox full') ||
    errorLower.includes('quota exceeded') ||
    errorLower.includes('over quota')
  ) {
    return {
      bounceType: BounceType.SOFT,
      bounceCategory: BounceCategory.MAILBOX_FULL,
      reason: error,
    };
  }

  if (errorLower.includes('too large') || errorLower.includes('message size')) {
    return {
      bounceType: BounceType.SOFT,
      bounceCategory: BounceCategory.MESSAGE_TOO_LARGE,
      reason: error,
    };
  }

  if (errorLower.includes('blocked') || errorLower.includes('spam')) {
    return {
      bounceType: BounceType.HARD,
      bounceCategory: BounceCategory.BLOCKED,
      reason: error,
    };
  }

  // Default to soft bounce
  return {
    bounceType: BounceType.SOFT,
    bounceCategory: BounceCategory.OTHER,
    reason: error,
  };
}



