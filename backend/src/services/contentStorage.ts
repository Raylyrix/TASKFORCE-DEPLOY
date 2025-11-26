/**
 * Content Storage Service
 * 
 * Instead of storing email/campaign content in our database,
 * we store only IDs and fetch content from Gmail API when needed.
 * This keeps our database small and secure.
 */

import { google } from "googleapis";

import { googleAuthService } from "./googleAuth";

/**
 * Store only metadata, not content
 * Content is fetched from Gmail when needed
 */
export interface EmailMetadata {
  gmailMessageId: string;
  threadId?: string;
  subject?: string; // Only for display/search, not full content
  from?: string;
  to?: string;
  date?: string;
  labelIds?: string[];
  snippet?: string; // Short preview only
}

/**
 * Fetch email content from Gmail API (not stored in our DB)
 */
export const fetchEmailContent = async (
  userId: string,
  messageId: string,
): Promise<{
  subject: string;
  from: string;
  to: string;
  body: string;
  html: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
}> => {
  const client = await googleAuthService.getAuthorizedClientForUser(userId);
  const gmail = google.gmail({ version: "v1", auth: client });

  const { data } = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = (data.payload?.headers ?? []).reduce(
    (acc, header) => {
      if (header.name && header.value) {
        acc[header.name.toLowerCase()] = header.value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  // Extract body
  let body = "";
  let html = "";

  const extractBody = (part: any): void => {
    if (part.body?.data) {
      const content = Buffer.from(part.body.data, "base64").toString("utf-8");
      if (part.mimeType === "text/html") {
        html = content;
      } else if (part.mimeType === "text/plain") {
        body = content;
      }
    }

    if (part.parts) {
      part.parts.forEach(extractBody);
    }
  };

  if (data.payload) {
    extractBody(data.payload);
  }

  // Extract attachments
  const attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }> = [];

  const extractAttachments = (part: any): void => {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
      });
    }

    if (part.parts) {
      part.parts.forEach(extractAttachments);
    }
  };

  if (data.payload) {
    extractAttachments(data.payload);
  }

  return {
    subject: headers.subject || "(No Subject)",
    from: headers.from || "Unknown",
    to: headers.to || "Unknown",
    body,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
};

/**
 * Store only campaign metadata, not content
 * Content is stored in Gmail after sending
 */
export interface CampaignMetadata {
  id: string;
  userId: string;
  name: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  createdAt: Date;
  // No template content stored - fetched from Gmail when needed
}

/**
 * Store only message log metadata
 */
export interface MessageLogMetadata {
  id: string;
  campaignId: string;
  gmailMessageId: string; // Only ID, not content
  to: string;
  status: string;
  opens: number;
  clicks: number;
  createdAt: Date;
  // No subject/body stored - fetched from Gmail when needed
}


