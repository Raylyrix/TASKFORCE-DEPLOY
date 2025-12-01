import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { requireUser } from "../../middleware/requireUser";
import {
  getOrCreateSendingDomain,
  verifyDomain,
  generateSPFRecord,
  generateDMARCRecord,
  generateDKIMKeys,
} from "../../services/domainAuthService";
import {
  calculateReputation,
  isDomainInGoodStanding,
  getSendingLimits,
} from "../../services/reputationService";
import { getWarmupStatus, startWarmup } from "../../services/warmupService";

const router = Router();

// Get all sending domains for user
router.get("/", requireUser, async (req, res) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.currentUser.id;

    const domains = await prisma.sendingDomain.findMany({
      where: { userId },
      include: {
        reputation: true,
        _count: {
          select: {
            bounces: true,
            complaints: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(domains);
  } catch (error: any) {
    logger.error({ error, userId: req.currentUser?.id }, "Failed to fetch sending domains");
    res.status(500).json({ error: "Failed to fetch sending domains" });
  }
});

// Get single sending domain
router.get("/:id", requireUser, async (req, res) => {
  try {
    const userId = req.currentUser!.id;
    const { id } = req.params;

    const domain = await prisma.sendingDomain.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        reputation: true,
        warmups: {
          orderBy: { day: "asc" },
        },
        _count: {
          select: {
            bounces: true,
            complaints: true,
          },
        },
      },
    });

    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }

    res.json(domain);
  } catch (error: any) {
    logger.error({ error, userId: req.currentUser?.id }, "Failed to fetch sending domain");
    res.status(500).json({ error: "Failed to fetch sending domain" });
  }
});

// Create or get sending domain
const createDomainSchema = z.object({
  domain: z.string().email().or(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/)),
});

router.post("/", requireUser, async (req, res) => {
  try {
    const userId = req.currentUser!.id;
    const { domain } = createDomainSchema.parse(req.body);

    // Extract domain from email if provided
    const actualDomain = domain.includes("@") ? domain.split("@")[1] : domain;

    const sendingDomain = await getOrCreateSendingDomain(userId, actualDomain);

    res.json(sendingDomain);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    logger.error({ error, userId: req.currentUser?.id }, "Failed to create sending domain");
    res.status(500).json({ error: "Failed to create sending domain" });
  }
});

// Verify domain authentication records
router.post("/:id/verify", requireUser, async (req, res) => {
  try {
    const userId = req.currentUser!.id;
    const { id } = req.params;

    const sendingDomain = await prisma.sendingDomain.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!sendingDomain) {
      return res.status(404).json({ error: "Domain not found" });
    }

    const verification = await verifyDomain(
      sendingDomain.domain,
      sendingDomain.spfRecord || undefined,
      sendingDomain.dkimSelector || undefined,
      sendingDomain.dkimPublicKey || undefined,
      sendingDomain.dmarcPolicy || undefined
    );

    // Update verification status
    await prisma.sendingDomain.update({
      where: { id },
      data: {
        spfVerified: verification.spfVerified,
        dkimVerified: verification.dkimVerified,
        dmarcVerified: verification.dmarcVerified,
        isVerified: verification.isVerified,
        verificationAt: verification.isVerified ? new Date() : null,
      },
    });

    res.json(verification);
  } catch (error: any) {
    logger.error({ error, userId: req.currentUser?.id }, "Failed to verify domain");
    res.status(500).json({ error: "Failed to verify domain" });
  }
});

// Get domain reputation
router.get("/:id/reputation", requireUser, async (req, res) => {
  try {
    const userId = req.currentUser!.id;
    const { id } = req.params;

    const sendingDomain = await prisma.sendingDomain.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!sendingDomain) {
      return res.status(404).json({ error: "Domain not found" });
    }

    const reputation = await calculateReputation(id);
    const inGoodStanding = await isDomainInGoodStanding(id);
    const limits = await getSendingLimits(id);

    res.json({
      reputation,
      inGoodStanding,
      limits,
    });
  } catch (error: any) {
    logger.error({ error, userId: req.currentUser?.id }, "Failed to fetch domain reputation");
    res.status(500).json({ error: "Failed to fetch domain reputation" });
  }
});

// Get warm-up status
router.get("/:id/warmup", requireUser, async (req, res) => {
  try {
    const userId = req.currentUser!.id;
    const { id } = req.params;

    const sendingDomain = await prisma.sendingDomain.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!sendingDomain) {
      return res.status(404).json({ error: "Domain not found" });
    }

    const warmupStatus = await getWarmupStatus(id);

    res.json(warmupStatus);
  } catch (error: any) {
    logger.error({ error, userId: req.currentUser?.id }, "Failed to fetch warm-up status");
    res.status(500).json({ error: "Failed to fetch warm-up status" });
  }
});

// Start warm-up
router.post("/:id/warmup/start", requireUser, async (req, res) => {
  try {
    const userId = req.currentUser!.id;
    const { id } = req.params;

    const sendingDomain = await prisma.sendingDomain.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!sendingDomain) {
      return res.status(404).json({ error: "Domain not found" });
    }

    await startWarmup(id);

    res.json({ success: true });
  } catch (error: any) {
    logger.error({ error, userId: req.currentUser?.id }, "Failed to start warm-up");
    res.status(500).json({ error: "Failed to start warm-up" });
  }
});

// Get DNS records for domain setup
router.get("/:id/dns-records", requireUser, async (req, res) => {
  try {
    const userId = req.currentUser!.id;
    const { id } = req.params;

    const sendingDomain = await prisma.sendingDomain.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!sendingDomain) {
      return res.status(404).json({ error: "Domain not found" });
    }

    const dnsRecords = [];

    // SPF record
    if (sendingDomain.spfRecord) {
      dnsRecords.push({
        type: "TXT",
        name: sendingDomain.domain,
        value: sendingDomain.spfRecord,
        verified: sendingDomain.spfVerified,
      });
    }

    // DKIM record
    if (sendingDomain.dkimSelector && sendingDomain.dkimPublicKey) {
      const dkimValue = `v=DKIM1; k=rsa; p=${sendingDomain.dkimPublicKey}`;
      dnsRecords.push({
        type: "TXT",
        name: `${sendingDomain.dkimSelector}._domainkey.${sendingDomain.domain}`,
        value: dkimValue,
        verified: sendingDomain.dkimVerified,
      });
    }

    // DMARC record
    if (sendingDomain.dmarcPolicy) {
      dnsRecords.push({
        type: "TXT",
        name: `_dmarc.${sendingDomain.domain}`,
        value: sendingDomain.dmarcPolicy,
        verified: sendingDomain.dmarcVerified,
      });
    }

    res.json(dnsRecords);
  } catch (error: any) {
    logger.error({ error, userId: req.currentUser?.id }, "Failed to fetch DNS records");
    res.status(500).json({ error: "Failed to fetch DNS records" });
  }
});

export default router;



