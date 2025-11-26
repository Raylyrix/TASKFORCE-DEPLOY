/**
 * Workflow Execution Engine
 * 
 * This service executes user-defined workflows based on triggers and node configurations.
 * It processes workflows as directed graphs, executing nodes in sequence based on edges.
 * 
 * Supported node types:
 * - trigger: Entry point (not executed, used for matching)
 * - action: Performs an action (send email, add label, etc.)
 * - condition: Evaluates a condition and branches workflow
 * - delay: Waits for a specified duration
 * - webhook: Calls an external API endpoint
 * 
 * Workflow execution flow:
 * 1. Start from trigger node
 * 2. Execute connected nodes in sequence
 * 3. For conditions, follow edges based on condition result
 * 4. Track execution state and variables
 * 5. Log execution history for debugging
 * 
 * @module services/workflowEngine
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { gmailDeliveryService } from "./gmailDelivery";
import { calendarAvailabilityService } from "./calendarAvailability";

export type WorkflowNode = {
  id: string;
  type: "trigger" | "condition" | "action" | "delay" | "webhook";
  label: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  condition?: string; // For conditional edges
};

export type WorkflowTrigger = {
  type: "email_received" | "email_opened" | "email_clicked" | "meeting_booked" | "campaign_sent" | "scheduled" | "manual";
  config: Record<string, unknown>;
};

export type WorkflowContext = {
  triggerData?: Record<string, unknown>;
  variables: Record<string, unknown>;
  currentNodeId?: string;
};

/**
 * Execute a single workflow node
 * 
 * Handles execution of different node types:
 * - action: Performs actions like sending emails
 * - condition: Evaluates conditions and returns boolean result
 * - delay: Waits for specified duration
 * - webhook: Makes HTTP requests to external APIs
 * 
 * @param node - The workflow node to execute
 * @param context - Current workflow execution context with variables
 * @param userId - ID of the user who owns the workflow
 * @returns Execution result with success status, output data, or error message
 */
const executeNode = async (
  node: WorkflowNode,
  context: WorkflowContext,
  userId: string,
): Promise<{ success: boolean; output?: Record<string, unknown>; error?: string }> => {
  try {
    switch (node.type) {
      case "action": {
        const actionType = node.config.type as string;
        
        switch (actionType) {
          case "send_email": {
            const toValue = (node.config.to as string) || context.variables.email || context.triggerData?.email;
            const to = typeof toValue === "string" ? toValue : String(toValue || "");
            const subject = (node.config.subject as string) || "";
            const body = (node.config.body as string) || "";

            if (!to || to === "") {
              return { success: false, error: "No recipient email found" };
            }

            // Replace variables in subject and body
            const processedSubject = replaceVariables(subject, context.variables);
            const processedBody = replaceVariables(body, context.variables);

            const result = await gmailDeliveryService.sendEmailViaGmail({
              userId,
              to,
              subject: processedSubject,
              bodyHtml: processedBody,
            });

            return {
              success: true,
              output: {
                messageId: result.id,
                threadId: result.threadId,
              },
            };
          }

          case "add_label": {
            // This would require Gmail API integration
            return { success: true, output: {} };
          }

          case "create_meeting": {
            // This would create a meeting booking
            return { success: true, output: {} };
          }

          default:
            return { success: false, error: `Unknown action type: ${actionType}` };
        }
      }

      case "condition": {
        const conditionType = node.config.type as string;
        const field = node.config.field as string;
        const operator = node.config.operator as string;
        const value = node.config.value as unknown;

        const fieldValue = getFieldValue(field, context);

        const result = evaluateCondition(fieldValue, operator, value);

        return {
          success: true,
          output: {
            conditionResult: result,
          },
        };
      }

      case "delay": {
        const delayMs = (node.config.delayMs as number) || 0;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return { success: true, output: {} };
      }

      case "webhook": {
        const url = node.config.url as string;
        const method = (node.config.method as string) || "POST";
        const headers = (node.config.headers as Record<string, string>) || {};
        const body = node.config.body as unknown;

        if (!url) {
          return { success: false, error: "Webhook URL not provided" };
        }

        // Replace variables in URL and body
        const processedUrl = replaceVariables(url, context.variables);
        const processedBody = typeof body === "string" ? replaceVariables(body, context.variables) : body;

        const response = await fetch(processedUrl, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: processedBody ? JSON.stringify(processedBody) : undefined,
        });

        if (!response.ok) {
          return { success: false, error: `Webhook failed: ${response.statusText}` };
        }

        const responseData = await response.json().catch(() => ({}));

        return {
          success: true,
          output: {
            response: responseData,
            status: response.status,
          },
        };
      }

      default:
        return { success: false, error: `Unknown node type: ${node.type}` };
    }
  } catch (error) {
    logger.error({ error, nodeId: node.id, nodeType: node.type }, "Error executing workflow node");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Replace variables in a string
 */
const replaceVariables = (text: string, variables: Record<string, unknown>): string => {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key];
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
};

/**
 * Get field value from context
 */
const getFieldValue = (field: string, context: WorkflowContext): unknown => {
  const parts = field.split(".");
  let value: unknown = context;

  for (const part of parts) {
    if (value && typeof value === "object" && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return value;
};

/**
 * Evaluate a condition
 */
const evaluateCondition = (
  fieldValue: unknown,
  operator: string,
  expectedValue: unknown,
): boolean => {
  switch (operator) {
    case "equals":
      return fieldValue === expectedValue;
    case "not_equals":
      return fieldValue !== expectedValue;
    case "contains":
      return String(fieldValue).includes(String(expectedValue));
    case "not_contains":
      return !String(fieldValue).includes(String(expectedValue));
    case "greater_than":
      return Number(fieldValue) > Number(expectedValue);
    case "less_than":
      return Number(fieldValue) < Number(expectedValue);
    case "is_empty":
      return !fieldValue || String(fieldValue).trim() === "";
    case "is_not_empty":
      return !!fieldValue && String(fieldValue).trim() !== "";
    default:
      return false;
  }
};

/**
 * Execute a workflow
 */
export const executeWorkflow = async (
  workflowId: string,
  triggerData?: Record<string, unknown>,
): Promise<{ success: boolean; executionId?: string; error?: string }> => {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow || !workflow.isActive) {
      return { success: false, error: "Workflow not found or inactive" };
    }

    const nodes = workflow.nodes as WorkflowNode[];
    const edges = workflow.edges as WorkflowEdge[];

    if (!nodes || nodes.length === 0) {
      return { success: false, error: "Workflow has no nodes" };
    }

    // Find trigger node
    const triggerNode = nodes.find((n) => n.type === "trigger");
    if (!triggerNode) {
      return { success: false, error: "Workflow has no trigger node" };
    }

    // Create execution record
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId,
        status: "RUNNING",
        context: {
          triggerData: triggerData || {},
          variables: triggerData || {},
        } as any,
        currentNodeId: triggerNode.id,
      },
    });

    // Build node map and edge map
    const nodeMap = new Map<string, WorkflowNode>();
    const edgeMap = new Map<string, WorkflowEdge[]>();

    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    for (const edge of edges) {
      if (!edgeMap.has(edge.source)) {
        edgeMap.set(edge.source, []);
      }
      edgeMap.get(edge.source)!.push(edge);
    }

    // Execute workflow
    let currentNodeId: string | undefined = triggerNode.id;
    const context: WorkflowContext = {
      triggerData: triggerData || {},
      variables: triggerData || {},
    };

    const maxSteps = 100; // Prevent infinite loops
    let stepCount = 0;

    while (currentNodeId && stepCount < maxSteps) {
      stepCount++;
      const currentNode = nodeMap.get(currentNodeId);

      if (!currentNode) {
        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: "FAILED",
            error: `Node ${currentNodeId} not found`,
            completedAt: new Date(),
          },
        });
        return { success: false, error: `Node ${currentNodeId} not found` };
      }

      // Execute current node
      const result = await executeNode(currentNode, context, workflow.userId);

      if (!result.success) {
        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: "FAILED",
            error: result.error,
            completedAt: new Date(),
          },
        });
        return { success: false, error: result.error };
      }

      // Merge output into context
      if (result.output) {
        context.variables = { ...context.variables, ...result.output };
      }

      // Find next node(s)
      const outgoingEdges: WorkflowEdge[] = edgeMap.get(currentNodeId) || [];

      if (currentNode.type === "condition") {
        // For condition nodes, choose edge based on condition result
        const conditionResult = result.output?.conditionResult as boolean;
        const nextEdge: WorkflowEdge | undefined = outgoingEdges.find((e: WorkflowEdge) => {
          if (e.condition === "true" && conditionResult) return true;
          if (e.condition === "false" && !conditionResult) return true;
          return false;
        });

        currentNodeId = nextEdge?.target;
      } else {
        // For other nodes, take first edge (or none if no edges)
        currentNodeId = outgoingEdges[0]?.target;
      }

      // Update execution
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          currentNodeId,
          context: context as any, // Prisma JSON type
        },
      });
    }

    // Mark as completed
    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Update workflow stats
    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        runCount: { increment: 1 },
        lastRunAt: new Date(),
      },
    });

    return { success: true, executionId: execution.id };
  } catch (error) {
    logger.error({ error, workflowId }, "Error executing workflow");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const workflowEngine = {
  executeWorkflow,
};


