import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";

import { requireUser } from "../../middleware/requireUser";
import { prisma } from "../../lib/prisma";
import { campaignEngine } from "../../services/campaignEngine";

export const followUpsRouter = Router();

const followUpStepSchema = z.object({
  delayMs: z.number().int().min(0),
  subject: z.string().min(1),
  html: z.string().min(1),
  sendAsReply: z.boolean().optional().default(false),
  parentStepId: z.string().optional(),
  isNested: z.boolean().optional().default(false),
});

const createFollowUpSchema = z.object({
  campaignId: z.string().min(1),
  name: z.string().min(1),
  steps: z.array(followUpStepSchema).min(1),
});

const automationTargetSchema = z.union([
  z.object({ type: z.literal("label"), labelIds: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("query"), query: z.string().min(1) }),
  z.object({ type: z.literal("folder"), folderId: z.string().min(1) }),
]);

const automationConditionSchema = z.object({
  field: z.enum(["noReplySince", "hasLabel", "threadStatus", "manualTag"]),
  operator: z.enum(["gt", "lt", "includes", "excludes", "equals"]),
  value: z.string(),
  unit: z.enum(["hours", "days"]).optional(),
});

const automationActionSchema = z.object({
  type: z.enum(["sendEmail", "applyLabel", "stopSequence"]),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  labelId: z.string().optional(),
});

const daysOfWeekEnum = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

const automationScheduleSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("relative"),
    sendAfterHours: z.number().int().min(0).optional(),
    sendAfterDays: z.number().int().min(0).optional(),
    timezone: z.string(),
  }),
  z.object({
    mode: z.literal("absolute"),
    sendAt: z.string().min(1),
    timezone: z.string(),
  }),
  z.object({
    mode: z.literal("weekly"),
    daysOfWeek: z.array(daysOfWeekEnum).min(1),
    sendTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "sendTime must be in HH:MM 24h format"),
    timezone: z.string(),
  }),
]);

const automationStopConditionsSchema = z.object({
  onReply: z.boolean().optional(),
  onOpen: z.boolean().optional(),
  onClick: z.boolean().optional(),
});

const automationRuleSchema = z.object({
  name: z.string().min(1),
  schedule: automationScheduleSchema,
  conditions: z.array(automationConditionSchema),
  actions: z.array(automationActionSchema).min(1),
  stopConditions: automationStopConditionsSchema.optional(),
  maxFollowUps: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

const createAutomationSchema = z.object({
  target: automationTargetSchema,
  timezone: z.string().min(1),
  rules: z.array(automationRuleSchema).min(1),
});

type AutomationRecord = z.infer<typeof createAutomationSchema> & {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  rules: Array<
    z.infer<typeof automationRuleSchema> & {
      id: string;
      conditions: Array<z.infer<typeof automationConditionSchema> & { id: string }>;
      actions: Array<z.infer<typeof automationActionSchema> & { id: string }>;
    }
  >;
};

const automationStore = new Map<string, AutomationRecord[]>();

followUpsRouter.get("/automations", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const automations = (automationStore.get(req.currentUser.id) ?? []).map((automation) => ({
      ...automation,
      rules: automation.rules.map((rule) => ({
        ...rule,
        stopConditions:
          rule.stopConditions ??
          {
            onReply: (rule as unknown as { stopOnReply?: boolean }).stopOnReply ?? true,
            onOpen: false,
            onClick: false,
          },
      })),
    }));
    res.status(200).json({ automations });
  } catch (error) {
    next(error);
  }
});

followUpsRouter.post("/", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = createFollowUpSchema.parse(req.body ?? {});

    const campaign = await prisma.campaign.findUnique({
      where: { id: payload.campaignId },
    });

    if (!campaign || campaign.userId !== req.currentUser.id) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const sequence = await campaignEngine.createFollowUpSequence(payload.campaignId, {
      name: payload.name,
      steps: payload.steps,
    });

    res.status(201).json({ sequence });
  } catch (error) {
    next(error);
  }
});

followUpsRouter.get("/:campaignId", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { campaignId } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.userId !== req.currentUser.id) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const sequences = await campaignEngine.listFollowUpSequences(campaignId);

    res.status(200).json({ sequences });
  } catch (error) {
    next(error);
  }
});

followUpsRouter.post("/automations", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = createAutomationSchema.parse(req.body ?? {});
    const normalizedRules = payload.rules.map((rule) => ({
      ...rule,
      stopConditions: {
        onReply: rule.stopConditions?.onReply ?? true,
        onOpen: rule.stopConditions?.onOpen ?? false,
        onClick: rule.stopConditions?.onClick ?? false,
      },
    }));

    const existing = automationStore.get(req.currentUser.id) ?? [];

    const automation: AutomationRecord = {
      ...payload,
      id: randomUUID(),
      userId: req.currentUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastRunAt: null,
      nextRunAt: null,
      rules: normalizedRules.map((rule) => ({
        ...rule,
        id: randomUUID(),
        conditions: rule.conditions.map((condition) => ({ ...condition, id: randomUUID() })),
        actions: rule.actions.map((action) => ({ ...action, id: randomUUID() })),
      })),
    };

    existing.push(automation);
    automationStore.set(req.currentUser.id, existing);

    res.status(201).json({ automation });
  } catch (error) {
    next(error);
  }
});


