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

  // Get user's email for proper From header
  const userInfo = await authClient.getAccessToken();
  // Note: Gmail API will automatically set the From header to the authenticated user's email
  // We don't need to set it manually, but we can add other deliverability headers

  const headers = [
    ["To", payload.to],
    ["Subject", payload.subject],
    ["Content-Type", 'text/html; charset="UTF-8"'],
    ["MIME-Version", "1.0"],
    // Deliverability best practices
    ["Precedence", "bulk"], // Indicates bulk email (helps with filtering)
    ["X-Auto-Response-Suppress", "All"], // Prevents auto-replies
    ["Auto-Submitted", "auto-generated"], // Indicates automated email
  ];

  if (payload.cc?.length) {
    headers.push(["Cc", payload.cc.join(", ")]);
  }
  if (payload.bcc?.length) {
    headers.push(["Bcc", payload.bcc.join(", ")]);
  }

  // Add custom headers if provided
  if (payload.headers) {
    for (const [key, value] of Object.entries(payload.headers)) {
      // Don't override critical headers
      const lowerKey = key.toLowerCase();
      if (!["to", "from", "subject", "content-type", "mime-version"].includes(lowerKey)) {
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

  return {
    id: response.data.id ?? "",
    threadId: response.data.threadId ?? null,
  };
};

export const gmailDeliveryService = {
  sendEmailViaGmail,
};


