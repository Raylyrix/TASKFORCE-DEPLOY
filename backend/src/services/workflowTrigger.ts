/**
 * Workflow Trigger Service
 * 
 * This service automatically triggers workflows based on real-time events in the system.
 * It integrates with email tracking, meeting bookings, and campaign completion to
 * execute user-defined automation workflows.
 * 
 * Supported trigger types:
 * - email_received: When a new email arrives
 * - email_opened: When an email tracking pixel is loaded
 * - email_clicked: When a tracked link in an email is clicked
 * - meeting_booked: When a meeting booking is created
 * - campaign_sent: When a campaign finishes sending all recipients
 * 
 * @module services/workflowTrigger
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { workflowEngine } from "./workflowEngine";

/**
 * Represents a trigger event that can activate workflows
 */
export type TriggerEvent = {
  /** Type of event that occurred */
  type: "email_received" | "email_opened" | "email_clicked" | "meeting_booked" | "campaign_sent";
  /** ID of the user who owns the workflow */
  userId: string;
  /** Event-specific data that workflows can use */
  data: Record<string, unknown>;
};

/**
 * Find and trigger all active workflows matching an event
 * 
 * This function:
 * 1. Finds all active workflows for the user
 * 2. Checks if the workflow trigger matches the event type
 * 3. Validates trigger conditions (from email, subject, etc.)
 * 4. Executes matching workflows
 * 
 * @param event - The trigger event that occurred
 * @returns Promise that resolves when all workflows are processed
 */
export const triggerWorkflowsForEvent = async (event: TriggerEvent): Promise<void> => {
  try {
    // Find all active workflows for this user that match the trigger
    const workflows = await prisma.workflow.findMany({
      where: {
        userId: event.userId,
        isActive: true,
      },
    });

    for (const workflow of workflows) {
      const trigger = workflow.trigger as { type: string; config: Record<string, unknown> };

      // Check if workflow trigger matches event type
      if (trigger.type !== event.type) {
        continue;
      }

      // Check trigger conditions if any
      if (!matchesTriggerConditions(trigger.config, event.data)) {
        continue;
      }

      // Execute workflow
      logger.info(
        {
          workflowId: workflow.id,
          workflowName: workflow.name,
          eventType: event.type,
        },
        "Triggering workflow for event",
      );

      const result = await workflowEngine.executeWorkflow(workflow.id, {
        ...event.data,
        eventType: event.type,
        userId: event.userId,
      });

      if (!result.success) {
        logger.error(
          {
            workflowId: workflow.id,
            error: result.error,
          },
          "Workflow execution failed",
        );
      }
    }
  } catch (error) {
    logger.error({ error, event }, "Error triggering workflows for event");
  }
};

/**
 * Check if event data matches workflow trigger conditions
 * 
 * Validates conditions like:
 * - From email (supports wildcard "*" for any email)
 * - Subject contains specific text
 * - Label IDs match
 * - Meeting type ID matches
 * - Campaign ID matches
 * 
 * @param triggerConfig - Configuration from the workflow trigger
 * @param eventData - Data from the actual event
 * @returns true if all conditions match, false otherwise
 */
const matchesTriggerConditions = (
  triggerConfig: Record<string, unknown>,
  eventData: Record<string, unknown>,
): boolean => {
  // Check from email if specified
  if (triggerConfig.from && eventData.from) {
    const triggerFrom = String(triggerConfig.from).toLowerCase();
    const eventFrom = String(eventData.from).toLowerCase();
    if (!eventFrom.includes(triggerFrom) && triggerFrom !== "*") {
      return false;
    }
  }

  // Check subject if specified
  if (triggerConfig.subject && eventData.subject) {
    const triggerSubject = String(triggerConfig.subject).toLowerCase();
    const eventSubject = String(eventData.subject).toLowerCase();
    if (!eventSubject.includes(triggerSubject) && triggerSubject !== "*") {
      return false;
    }
  }

  // Check label if specified
  if (triggerConfig.label && eventData.labelIds) {
    const triggerLabel = String(triggerConfig.label);
    const eventLabels = Array.isArray(eventData.labelIds) ? eventData.labelIds : [];
    if (!eventLabels.includes(triggerLabel) && triggerLabel !== "*") {
      return false;
    }
  }

  // Check meeting type if specified
  if (triggerConfig.meetingTypeId && eventData.meetingTypeId) {
    if (triggerConfig.meetingTypeId !== eventData.meetingTypeId) {
      return false;
    }
  }

  // Check campaign if specified
  if (triggerConfig.campaignId && eventData.campaignId) {
    if (triggerConfig.campaignId !== eventData.campaignId) {
      return false;
    }
  }

  return true;
};

/**
 * Trigger workflows for email received event
 */
export const triggerEmailReceived = async (
  userId: string,
  emailData: {
    from: string;
    subject: string;
    body?: string;
    labelIds?: string[];
    messageId: string;
    threadId?: string;
  },
): Promise<void> => {
  await triggerWorkflowsForEvent({
    type: "email_received",
    userId,
    data: {
      email: emailData.from,
      from: emailData.from,
      subject: emailData.subject,
      body: emailData.body,
      labelIds: emailData.labelIds,
      messageId: emailData.messageId,
      threadId: emailData.threadId,
    },
  });
};

/**
 * Trigger workflows when an email is opened
 * 
 * Called when the email tracking pixel is loaded, indicating the email was opened.
 * 
 * @param userId - ID of the user who sent the email
 * @param emailData - Email tracking data (messageLogId, recipient, subject, campaignId)
 */
export const triggerEmailOpened = async (
  userId: string,
  emailData: {
    messageLogId: string;
    to: string;
    subject: string;
    campaignId?: string;
  },
): Promise<void> => {
  await triggerWorkflowsForEvent({
    type: "email_opened",
    userId,
    data: {
      messageLogId: emailData.messageLogId,
      email: emailData.to,
      to: emailData.to,
      subject: emailData.subject,
      campaignId: emailData.campaignId,
    },
  });
};

/**
 * Trigger workflows when a tracked link in an email is clicked
 * 
 * Called when a recipient clicks a link that was wrapped with tracking.
 * 
 * @param userId - ID of the user who sent the email
 * @param emailData - Click tracking data (messageLogId, recipient, subject, URL, campaignId)
 */
export const triggerEmailClicked = async (
  userId: string,
  emailData: {
    messageLogId: string;
    to: string;
    subject: string;
    url: string;
    campaignId?: string;
  },
): Promise<void> => {
  await triggerWorkflowsForEvent({
    type: "email_clicked",
    userId,
    data: {
      messageLogId: emailData.messageLogId,
      email: emailData.to,
      to: emailData.to,
      subject: emailData.subject,
      url: emailData.url,
      campaignId: emailData.campaignId,
    },
  });
};

/**
 * Trigger workflows when a meeting is booked
 * 
 * Called when a booking is created through the public booking page.
 * 
 * @param userId - ID of the user who owns the meeting type
 * @param meetingData - Booking details (bookingId, meetingTypeId, invitee, times)
 */
export const triggerMeetingBooked = async (
  userId: string,
  meetingData: {
    bookingId: string;
    meetingTypeId: string;
    inviteeEmail: string;
    inviteeName?: string;
    startTime: Date;
    endTime: Date;
  },
): Promise<void> => {
  await triggerWorkflowsForEvent({
    type: "meeting_booked",
    userId,
    data: {
      bookingId: meetingData.bookingId,
      meetingTypeId: meetingData.meetingTypeId,
      inviteeEmail: meetingData.inviteeEmail,
      inviteeName: meetingData.inviteeName,
      startTime: meetingData.startTime.toISOString(),
      endTime: meetingData.endTime.toISOString(),
    },
  });
};

/**
 * Trigger workflows when a campaign finishes sending
 * 
 * Called when all recipients in a campaign have been sent emails.
 * 
 * @param userId - ID of the user who owns the campaign
 * @param campaignData - Campaign completion data (campaignId, name, recipientCount)
 */
export const triggerCampaignSent = async (
  userId: string,
  campaignData: {
    campaignId: string;
    campaignName: string;
    recipientCount: number;
  },
): Promise<void> => {
  await triggerWorkflowsForEvent({
    type: "campaign_sent",
    userId,
    data: {
      campaignId: campaignData.campaignId,
      campaignName: campaignData.campaignName,
      recipientCount: campaignData.recipientCount,
    },
  });
};

export const workflowTriggerService = {
  triggerWorkflowsForEvent,
  triggerEmailReceived,
  triggerEmailOpened,
  triggerEmailClicked,
  triggerMeetingBooked,
  triggerCampaignSent,
};


