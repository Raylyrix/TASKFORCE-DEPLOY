import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../middleware/requireUser";

export const emailAssignmentsRouter = Router();

const assignmentCreateSchema = z.object({
  teamId: z.string(),
  sharedInboxId: z.string().optional(),
  messageId: z.string(),
  threadId: z.string().optional(),
  assignedToId: z.string().optional(),
  priority: z.number().int().min(0).max(2).optional(),
  notes: z.string().optional(),
});

const assignmentUpdateSchema = z.object({
  assignedToId: z.string().optional(),
  status: z.enum(["UNASSIGNED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.number().int().min(0).max(2).optional(),
  notes: z.string().optional(),
});

// Create assignment
emailAssignmentsRouter.post("/", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = assignmentCreateSchema.parse(req.body);

    // Check if user is a team member
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: payload.teamId,
          userId: currentUser.id,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ error: "Not a member of this team" });
      return;
    }

    // Check if assignment already exists
    const existing = await prisma.emailAssignment.findFirst({
      where: {
        teamId: payload.teamId,
        messageId: payload.messageId,
      },
    });

    if (existing) {
      res.status(400).json({ error: "Email already assigned in this team" });
      return;
    }

    const status = payload.assignedToId ? "ASSIGNED" : "UNASSIGNED";

    const assignment = await prisma.emailAssignment.create({
      data: {
        teamId: payload.teamId,
        sharedInboxId: payload.sharedInboxId,
        messageId: payload.messageId,
        threadId: payload.threadId,
        assignedToId: payload.assignedToId,
        assignedById: currentUser.id,
        status,
        priority: payload.priority || 0,
        notes: payload.notes,
        assignedAt: payload.assignedToId ? new Date() : null,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            displayName: true,
            pictureUrl: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        sharedInbox: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({ assignment });
  } catch (error) {
    next(error);
  }
});

// Get assignments
emailAssignmentsRouter.get("/", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const teamId = typeof req.query.teamId === "string" ? req.query.teamId : undefined;
    const assignedToId = typeof req.query.assignedToId === "string" ? req.query.assignedToId : undefined;
    const status = typeof req.query.status === "string" ? req.query.status as any : undefined;
    const sharedInboxId = typeof req.query.sharedInboxId === "string" ? req.query.sharedInboxId : undefined;

    // Build where clause
    const where: any = {};

    if (teamId) {
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

      where.teamId = teamId;
    } else {
      // Get all teams user is a member of
      const memberships = await prisma.teamMember.findMany({
        where: { userId: currentUser.id },
        select: { teamId: true },
      });

      where.teamId = {
        in: memberships.map((m) => m.teamId),
      };
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (status) {
      where.status = status;
    }

    if (sharedInboxId) {
      where.sharedInboxId = sharedInboxId;
    }

    const assignments = await prisma.emailAssignment.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            displayName: true,
            pictureUrl: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        sharedInbox: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    res.status(200).json({ assignments });
  } catch (error) {
    next(error);
  }
});

// Get assignment by ID
emailAssignmentsRouter.get("/:assignmentId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { assignmentId } = req.params;

    const assignment = await prisma.emailAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            displayName: true,
            pictureUrl: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        sharedInbox: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    // Check if user is a team member
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: assignment.teamId,
          userId: currentUser.id,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ error: "Not a member of this team" });
      return;
    }

    res.status(200).json({ assignment });
  } catch (error) {
    next(error);
  }
});

// Update assignment
emailAssignmentsRouter.put("/:assignmentId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { assignmentId } = req.params;
    const payload = assignmentUpdateSchema.parse(req.body);

    const assignment = await prisma.emailAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    // Check if user is a team member
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: assignment.teamId,
          userId: currentUser.id,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ error: "Not a member of this team" });
      return;
    }

    // Check if user can update (assigned to them, or admin/owner)
    const canUpdate =
      assignment.assignedToId === currentUser.id ||
      membership.role === "OWNER" ||
      membership.role === "ADMIN";

    if (!canUpdate) {
      res.status(403).json({ error: "Cannot update this assignment" });
      return;
    }

    const updateData: any = {};

    if (payload.assignedToId !== undefined) {
      updateData.assignedToId = payload.assignedToId;
      updateData.assignedById = currentUser.id;
      updateData.assignedAt = payload.assignedToId ? new Date() : null;
      if (payload.status === undefined) {
        updateData.status = payload.assignedToId ? "ASSIGNED" : "UNASSIGNED";
      }
    }

    if (payload.status !== undefined) {
      updateData.status = payload.status;
      if (payload.status === "RESOLVED" || payload.status === "CLOSED") {
        updateData.resolvedAt = new Date();
      }
    }

    if (payload.priority !== undefined) {
      updateData.priority = payload.priority;
    }

    if (payload.notes !== undefined) {
      updateData.notes = payload.notes;
    }

    const updatedAssignment = await prisma.emailAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            displayName: true,
            pictureUrl: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        sharedInbox: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(200).json({ assignment: updatedAssignment });
  } catch (error) {
    next(error);
  }
});

// Delete assignment
emailAssignmentsRouter.delete("/:assignmentId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { assignmentId } = req.params;

    const assignment = await prisma.emailAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    // Check if user is admin or owner
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: assignment.teamId,
          userId: currentUser.id,
        },
      },
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      res.status(403).json({ error: "Only team owners and admins can delete assignments" });
      return;
    }

    await prisma.emailAssignment.delete({
      where: { id: assignmentId },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

