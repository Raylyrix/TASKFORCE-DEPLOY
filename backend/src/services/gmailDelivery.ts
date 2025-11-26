import { google } from "googleapis";

import { googleAuthService } from "./googleAuth";

type SendEmailInput = {
  userId: string;
  to: string;
  subject: string;
  bodyHtml: string;
  cc?: string[];
  bcc?: string[];
  threadId?: string | null;
  headers?: Record<string, string>;
  labelIds?: string[]; // Gmail label IDs to apply to the sent message
};

const toBase64Url = (input: string) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const sendEmailViaGmail = async (payload: SendEmailInput) => {
  const authClient = await googleAuthService.getAuthorizedClientForUser(payload.userId);
  const gmail = google.gmail({
    version: "v1",
    auth: authClient,
  });

  const headers = [
    ["To", payload.to],
    ["Subject", payload.subject],
    ["Content-Type", 'text/html; charset="UTF-8"'],
    ["MIME-Version", "1.0"],
  ];

  if (payload.cc?.length) {
    headers.push(["Cc", payload.cc.join(", ")]);
  }
  if (payload.bcc?.length) {
    headers.push(["Bcc", payload.bcc.join(", ")]);
  }

  // Add reply headers if provided
  if (payload.headers) {
    for (const [key, value] of Object.entries(payload.headers)) {
      if (value) {
        headers.push([key, value]);
      }
    }
  }

  const message = `${headers.map(([key, value]) => `${key}: ${value}`).join("\r\n")}\r\n\r\n${
    payload.bodyHtml
  }`;

  const raw = toBase64Url(message);

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: payload.threadId ?? undefined,
    },
  });

  const messageId = response.data.id ?? "";
  const threadId = response.data.threadId ?? null;

  // Apply labels if provided (must be done after sending)
  if (payload.labelIds && payload.labelIds.length > 0 && messageId) {
    try {
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: payload.labelIds,
        },
      });
    } catch (error) {
      // Log but don't fail - label application is non-critical
      console.warn("Failed to apply labels to sent message:", error);
    }
  }

  return {
    id: messageId,
    threadId,
  };
};

export const gmailDeliveryService = {
  sendEmailViaGmail,
};


