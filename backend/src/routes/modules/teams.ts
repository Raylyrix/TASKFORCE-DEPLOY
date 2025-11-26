import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../middleware/requireUser";

export const teamsRouter = Router();

const teamCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const teamUpdateSchema = teamCreateSchema.partial();

const teamMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).optional(),
});

// Create team
teamsRouter.post("/", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = teamCreateSchema.parse(req.body);
    const team = await prisma.team.create({
      data: {
        name: payload.name,
        description: payload.description,
        ownerId: currentUser.id,
        members: {
          create: {
            userId: currentUser.id,
            role: "OWNER",
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            displayName: true,
            pictureUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                pictureUrl: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({ team });
  } catch (error) {
    next(error);
  }
});

// Get user's teams
teamsRouter.get("/", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            userId: currentUser.id,
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            displayName: true,
            pictureUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                pictureUrl: true,
              },
            },
          },
        },
        sharedInboxes: {
          where: {
            isActive: true,
          },
        },
        _count: {
          select: {
            emailAssignments: true,
          },
        },
      },
    });

    res.status(200).json({ teams });
  } catch (error) {
    next(error);
  }
});

// Get team by ID
teamsRouter.get("/:teamId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { teamId } = req.params;

    // Check if user is a member
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: currentUser.id,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ error: "Not a member of this team" });
      return;
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            displayName: true,
            pictureUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                pictureUrl: true,
              },
            },
          },
        },
        sharedInboxes: {
          where: {
            isActive: true,
          },
        },
      },
    });

    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    res.status(200).json({ team });
  } catch (error) {
    next(error);
  }
});

// Update team
teamsRouter.put("/:teamId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { teamId } = req.params;
    const payload = teamUpdateSchema.parse(req.body);

    // Check if user is owner or admin
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: currentUser.id,
        },
      },
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      res.status(403).json({ error: "Only team owners and admins can update the team" });
      return;
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: payload,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            displayName: true,
            pictureUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                pictureUrl: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json({ team });
  } catch (error) {
    next(error);
  }
});

// Delete team
teamsRouter.delete("/:teamId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { teamId } = req.params;

    // Check if user is owner
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    if (team.ownerId !== currentUser.id) {
      res.status(403).json({ error: "Only team owner can delete the team" });
      return;
    }

    await prisma.team.delete({
      where: { id: teamId },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Add team member
teamsRouter.post("/:teamId/members", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { teamId } = req.params;
    const payload = teamMemberSchema.parse(req.body);

    // Check if user is owner or admin
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: currentUser.id,
        },
      },
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      res.status(403).json({ error: "Only team owners and admins can add members" });
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Check if already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: payload.userId,
        },
      },
    });

    if (existingMember) {
      res.status(400).json({ error: "User is already a member of this team" });
      return;
    }

    const teamMember = await prisma.teamMember.create({
      data: {
        teamId,
        userId: payload.userId,
        role: payload.role || "MEMBER",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            pictureUrl: true,
          },
        },
      },
    });

    res.status(201).json({ member: teamMember });
  } catch (error) {
    next(error);
  }
});

// Remove team member
teamsRouter.delete("/:teamId/members/:userId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { teamId, userId } = req.params;

    // Check if user is owner or admin, or if removing themselves
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: currentUser.id,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ error: "Not a member of this team" });
      return;
    }

    const canRemove = membership.role === "OWNER" || membership.role === "ADMIN" || userId === currentUser.id;

    if (!canRemove) {
      res.status(403).json({ error: "Only team owners and admins can remove members" });
      return;
    }

    // Don't allow removing the owner
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (team?.ownerId === userId) {
      res.status(400).json({ error: "Cannot remove team owner" });
      return;
    }

    await prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Update team member role
teamsRouter.put("/:teamId/members/:userId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { teamId, userId } = req.params;
    const { role } = z.object({ role: z.enum(["OWNER", "ADMIN", "MEMBER"]) }).parse(req.body);

    // Check if user is owner
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: currentUser.id,
        },
      },
    });

    if (!membership || membership.role !== "OWNER") {
      res.status(403).json({ error: "Only team owner can update member roles" });
      return;
    }

    // Don't allow changing owner role
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (team?.ownerId === userId && role !== "OWNER") {
      res.status(400).json({ error: "Cannot change team owner role" });
      return;
    }

    const updatedMember = await prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            pictureUrl: true,
          },
        },
      },
    });

    res.status(200).json({ member: updatedMember });
  } catch (error) {
    next(error);
  }
});

// Create shared inbox
teamsRouter.post("/:teamId/shared-inboxes", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { teamId } = req.params;
    const payload = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      emailAddress: z.string().email().optional(),
    }).parse(req.body);

    // Check if user is a member
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: currentUser.id,
        },
      },
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      res.status(403).json({ error: "Only team owners and admins can create shared inboxes" });
      return;
    }

    const sharedInbox = await prisma.sharedInbox.create({
      data: {
        teamId,
        name: payload.name,
        description: payload.description,
        emailAddress: payload.emailAddress,
      },
    });

    res.status(201).json({ sharedInbox });
  } catch (error) {
    next(error);
  }
});

// Get shared inboxes for a team
teamsRouter.get("/:teamId/shared-inboxes", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { teamId } = req.params;

    // Check if user is a member
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: currentUser.id,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ error: "Not a member of this team" });
      return;
    }

    const sharedInboxes = await prisma.sharedInbox.findMany({
      where: {
        teamId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            emailAssignments: true,
          },
        },
      },
    });

    res.status(200).json({ sharedInboxes });
  } catch (error) {
    next(error);
  }
});


