import { Router } from "express";
import { z } from "zod";

import { requireUser } from "../../middleware/requireUser";
import { prisma } from "../../lib/prisma";
import { workflowEngine } from "../../services/workflowEngine";

export const workflowsRouter = Router();

const createWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.object({
    type: z.enum(["email_received", "email_opened", "email_clicked", "meeting_booked", "campaign_sent", "scheduled", "manual"]),
    config: z.record(z.string(), z.unknown()),
  }),
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["trigger", "condition", "action", "delay", "webhook"]),
      label: z.string(),
      config: z.record(z.string(), z.unknown()),
      position: z
        .object({
          x: z.number(),
          y: z.number(),
        })
        .optional(),
    }),
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      condition: z.string().optional(),
    }),
  ),
  isActive: z.boolean().optional().default(true),
});

const updateWorkflowSchema = createWorkflowSchema.partial();

// List workflows
workflowsRouter.get("/", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const workflows = await prisma.workflow.findMany({
      where: {
        userId: req.currentUser.id,
      },
      include: {
        _count: {
          select: {
            executions: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      workflows: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        trigger: w.trigger,
        isActive: w.isActive,
        runCount: w.runCount,
        lastRunAt: w.lastRunAt?.toISOString(),
        executionCount: w._count.executions,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get workflow by ID
workflowsRouter.get("/:workflowId", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: req.params.workflowId,
        userId: req.currentUser.id,
      },
    });

    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    res.status(200).json({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        trigger: workflow.trigger,
        nodes: workflow.nodes,
        edges: workflow.edges,
        isActive: workflow.isActive,
        runCount: workflow.runCount,
        lastRunAt: workflow.lastRunAt?.toISOString(),
        createdAt: workflow.createdAt.toISOString(),
        updatedAt: workflow.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create workflow
workflowsRouter.post("/", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = createWorkflowSchema.parse(req.body);

    const workflow = await prisma.workflow.create({
      data: {
        userId: req.currentUser.id,
        name: payload.name,
        description: payload.description,
        trigger: payload.trigger as any,
        nodes: payload.nodes as any,
        edges: payload.edges as any,
        isActive: payload.isActive ?? true,
      },
    });

    res.status(201).json({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        trigger: workflow.trigger,
        nodes: workflow.nodes,
        edges: workflow.edges,
        isActive: workflow.isActive,
        createdAt: workflow.createdAt.toISOString(),
        updatedAt: workflow.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update workflow
workflowsRouter.put("/:workflowId", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = updateWorkflowSchema.parse(req.body);

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: req.params.workflowId,
        userId: req.currentUser.id,
      },
    });

    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    const updated = await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.trigger !== undefined && { trigger: payload.trigger as any }),
        ...(payload.nodes !== undefined && { nodes: payload.nodes as any }),
        ...(payload.edges !== undefined && { edges: payload.edges as any }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive }),
      },
    });

    res.status(200).json({
      workflow: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        trigger: updated.trigger,
        nodes: updated.nodes,
        edges: updated.edges,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Delete workflow
workflowsRouter.delete("/:workflowId", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: req.params.workflowId,
        userId: req.currentUser.id,
      },
    });

    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    await prisma.workflow.delete({
      where: { id: workflow.id },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Execute workflow manually
workflowsRouter.post("/:workflowId/execute", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: req.params.workflowId,
        userId: req.currentUser.id,
      },
    });

    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    const triggerData = (req.body.triggerData as Record<string, unknown>) || {};

    const result = await workflowEngine.executeWorkflow(workflow.id, triggerData);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({
      success: true,
      executionId: result.executionId,
    });
  } catch (error) {
    next(error);
  }
});

// Get workflow executions
workflowsRouter.get("/:workflowId/executions", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: req.params.workflowId,
        userId: req.currentUser.id,
      },
    });

    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    const executions = await prisma.workflowExecution.findMany({
      where: {
        workflowId: workflow.id,
      },
      orderBy: {
        startedAt: "desc",
      },
      take: 50,
    });

    res.status(200).json({
      executions: executions.map((e) => ({
        id: e.id,
        status: e.status,
        currentNodeId: e.currentNodeId,
        error: e.error,
        startedAt: e.startedAt.toISOString(),
        completedAt: e.completedAt?.toISOString(),
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});


