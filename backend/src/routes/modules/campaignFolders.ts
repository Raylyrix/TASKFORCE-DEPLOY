import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { requireUser } from "../../middleware/requireUser";
import { googleAuthService } from "../../services/googleAuth";
import { google } from "googleapis";

const router = Router();

// Get all folders for user
router.get("/", requireUser, async (req, res) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.currentUser.id;

    const folders = await prisma.campaignFolder.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(folders);
  } catch (error: any) {
    logger.error({ error, userId: req.currentUser?.id }, "Failed to fetch campaign folders");
    res.status(500).json({ error: "Failed to fetch campaign folders" });
  }
});

// Get single folder
router.get("/:id", requireUser, async (req, res) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.currentUser.id;
    const { id } = req.params;

    const folder = await prisma.campaignFolder.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        campaigns: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    res.json(folder);
  } catch (error: any) {
    logger.error({ error, userId: req.currentUser?.id }, "Failed to fetch campaign folder");
    res.status(500).json({ error: "Failed to fetch campaign folder" });
  }
});

// Create folder
const createFolderSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  createGmailLabel: z.boolean().optional().default(false),
});

router.post("/", requireUser, async (req, res) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.currentUser.id;
    const { name, color, createGmailLabel } = createFolderSchema.parse(req.body);

    let gmailLabelId: string | undefined;

    // Create Gmail label if requested
    if (createGmailLabel) {
      try {
        const authClient = await googleAuthService.getAuthorizedClientForUser(userId);
        const gmail = google.gmail({
          version: "v1",
          auth: authClient,
        });

        const labelResponse = await gmail.users.labels.create({
          userId: "me",
          requestBody: {
            name: `TaskForce: ${name}`,
            labelListVisibility: "labelShow",
            messageListVisibility: "show",
          },
        });

        gmailLabelId = labelResponse.data.id || undefined;
      } catch (gmailError: any) {
        logger.warn(
          { error: gmailError, userId, folderName: name },
          "Failed to create Gmail label, creating folder without label"
        );
        // Continue without Gmail label
      }
    }

    const folder = await prisma.campaignFolder.create({
      data: {
        userId,
        name,
        color: color || undefined,
        gmailLabelId,
      },
    });

    res.json(folder);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    logger.error({ error, userId: req.currentUser?.id }, "Failed to create campaign folder");
    res.status(500).json({ error: "Failed to create campaign folder" });
  }
});

// Update folder
const updateFolderSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
});

router.patch("/:id", requireUser, async (req, res) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.currentUser.id;
    const { id } = req.params;
    const { name, color } = updateFolderSchema.parse(req.body);

    const folder = await prisma.campaignFolder.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const updated = await prisma.campaignFolder.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color !== undefined && { color }),
      },
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    logger.error({ error, userId: req.currentUser?.id }, "Failed to update campaign folder");
    res.status(500).json({ error: "Failed to update campaign folder" });
  }
});

// Delete folder
router.delete("/:id", requireUser, async (req, res) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.currentUser.id;
    const { id } = req.params;

    const folder = await prisma.campaignFolder.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    await prisma.campaignFolder.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error({ error, userId: req.currentUser?.id }, "Failed to delete campaign folder");
    res.status(500).json({ error: "Failed to delete campaign folder" });
  }
});

// Sync folder with Gmail label
router.post("/:id/sync-gmail-label", requireUser, async (req, res) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.currentUser.id;
    const { id } = req.params;

    const folder = await prisma.campaignFolder.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const authClient = await googleAuthService.getAuthorizedClientForUser(userId);
    const gmail = google.gmail({
      version: "v1",
      auth: authClient,
    });

    let gmailLabelId: string | null = folder.gmailLabelId;

    // Create Gmail label if it doesn't exist
    if (!gmailLabelId) {
      const labelResponse = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: `TaskForce: ${folder.name}`,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        },
      });

      gmailLabelId = labelResponse.data.id || null;
    }

    // Update folder with Gmail label ID
    const updated = await prisma.campaignFolder.update({
      where: { id },
      data: {
        gmailLabelId,
      },
    });

    // Update all campaigns in this folder to use the label
    // Note: updateMany doesn't support folderId filter yet, so we'll update individually
    const campaigns = await prisma.campaign.findMany({
      where: {
        folderId: id,
      },
    });
    
    await Promise.all(
      campaigns.map((campaign) =>
        prisma.campaign.update({
          where: { id: campaign.id },
          data: { gmailLabelId },
        })
      )
    );

    res.json(updated);
  } catch (error: any) {
    logger.error({ error, userId: req.currentUser?.id }, "Failed to sync Gmail label");
    res.status(500).json({ error: "Failed to sync Gmail label" });
  }
});

export default router;

