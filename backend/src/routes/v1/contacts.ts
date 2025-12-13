import { Router } from "express";
import { z } from "zod";

import { requireApiKey, requireScope } from "../../middleware/apiKeyAuthV1";
import { prisma } from "../../lib/prisma";

export const contactsV1Router = Router();

contactsV1Router.use(requireApiKey);

// List contacts (from campaign recipients)
contactsV1Router.get("/", requireScope("contacts:read"), async (req, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;

    // Get unique contacts from campaign recipients
    const where: any = {
      campaign: { userId },
    };

    if (search) {
      where.email = { contains: search, mode: "insensitive" };
    }

    // Get unique emails first
    const uniqueEmails = await prisma.campaignRecipient.findMany({
      where,
      select: {
        email: true,
      },
      distinct: ["email"],
      skip: (page - 1) * limit,
      take: limit,
    });

    const emailList = uniqueEmails.map(r => r.email);

    const [recipients, total] = await Promise.all([
      prisma.campaignRecipient.findMany({
        where: {
          ...where,
          email: { in: emailList },
        },
        select: {
          email: true,
          payload: true,
          status: true,
          createdAt: true,
          lastSentAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.campaignRecipient.groupBy({
        by: ["email"],
        where,
        _count: true,
      }).then(result => result.length),
    ]);

    const contacts = recipients.map(r => ({
      email: r.email,
      name: (r.payload as any)?.name || (r.payload as any)?.firstName || null,
      company: (r.payload as any)?.company || null,
      customFields: r.payload,
      status: r.status,
      lastContactedAt: r.lastSentAt?.toISOString() || null,
      createdAt: r.createdAt.toISOString(),
    }));

    res.json({
      success: true,
      data: contacts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get contact
contactsV1Router.get("/:email", requireScope("contacts:read"), async (req, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const email = decodeURIComponent(req.params.email);

    // Get contact from campaign recipients
    const recipient = await prisma.campaignRecipient.findFirst({
      where: {
        email,
        campaign: { userId },
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        messages: {
          select: {
            id: true,
            subject: true,
            status: true,
            opens: true,
            clicks: true,
            createdAt: true,
            sendAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Contact not found",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.json({
      success: true,
      data: {
        email: recipient.email,
        name: (recipient.payload as any)?.name || (recipient.payload as any)?.firstName || null,
        company: (recipient.payload as any)?.company || null,
        customFields: recipient.payload,
        status: recipient.status,
        campaigns: [{
          id: recipient.campaign.id,
          name: recipient.campaign.name,
          status: recipient.campaign.status,
        }],
        messages: recipient.messages,
        lastContactedAt: recipient.lastSentAt?.toISOString() || null,
        createdAt: recipient.createdAt.toISOString(),
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

