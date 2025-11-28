import { randomBytes } from "crypto";
import { google } from "googleapis";

import { AppConfig } from "../config/env";
import { googleAuthService } from "./googleAuth";
import { logger } from "../lib/logger";

type SendEmailInput = {
  userId: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string; // Plain text alternative
  cc?: string[];
  bcc?: string[];
  threadId?: string | null;
  headers?: Record<string, string>;
  isCampaign?: boolean; // Whether this is a campaign email (affects headers)
  inReplyTo?: string | null; // Message-ID of the message being replied to
  references?: string | null; // References header for threading
};

const toBase64Url = (input: string) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

// Generate a unique Message-ID
const generateMessageId = (userEmail: string): string => {
  const domain = userEmail.split("@")[1] || "gmail.com";
  const random = randomBytes(16).toString("hex");
  const timestamp = Date.now();
  return `<${timestamp}.${random}@${domain}>`;
};

// Convert HTML to plain text (simple version)
const htmlToText = (html: string): string => {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove style tags
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove script tags
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
};

// Helper function to get user's email signature from Gmail
const getUserSignature = async (userId: string, userEmail: string): Promise<string | null> => {
  try {
    const authClient = await googleAuthService.getAuthorizedClientForUser(userId);
    const gmail = google.gmail({
      version: "v1",
      auth: authClient,
    });

    // Get sendAs settings which contain the signature
    const sendAsList = await gmail.users.settings.sendAs.list({ userId: "me" });
    
    // Find the sendAs entry that matches the user's email
    const primarySendAs = sendAsList.data.sendAs?.find(
      (sendAs) => sendAs.sendAsEmail === userEmail || sendAs.isPrimary
    );

    if (primarySendAs?.signature) {
      return primarySendAs.signature;
    }

    // If no signature found, return null
    return null;
  } catch (error) {
    logger.warn(
      { error, userId, userEmail, errorMessage: error instanceof Error ? error.message : String(error) },
      "Failed to fetch user signature from Gmail, continuing without signature"
    );
    return null;
  }
};

// Helper function to append signature to email HTML
const appendSignature = (html: string, signature: string | null): string => {
  if (!signature || signature.trim().length === 0) {
    return html;
  }

  // Check if signature is already in the HTML to avoid duplicates
  if (html.includes(signature.trim())) {
    return html;
  }

  // Append signature with proper formatting
  // Add a separator if the HTML doesn't end with a closing tag
  const trimmedHtml = html.trim();
  const separator = trimmedHtml.endsWith("</div>") || trimmedHtml.endsWith("</p>") || trimmedHtml.endsWith("</body>")
    ? "<br><br>"
    : "<br><br>";

  return `${trimmedHtml}${separator}${signature}`;
};

export const sendEmailViaGmail = async (payload: SendEmailInput) => {
  const authClient = await googleAuthService.getAuthorizedClientForUser(payload.userId);
  const gmail = google.gmail({
    version: "v1",
    auth: authClient,
  });

  // Get user's email address
  const profile = await gmail.users.getProfile({ userId: "me" });
  const userEmail = profile.data.emailAddress || "";

  if (!userEmail) {
    throw new Error("Unable to retrieve user email address");
  }

  // Get user's signature
  const signature = await getUserSignature(payload.userId, userEmail);
  
  // Append signature to email body if available
  const bodyHtmlWithSignature = appendSignature(payload.bodyHtml, signature);

  // Generate Message-ID
  const messageId = generateMessageId(userEmail);
  const date = new Date().toUTCString();

  // Create plain text version if not provided (use HTML with signature for text conversion)
  const bodyText = payload.bodyText || htmlToText(bodyHtmlWithSignature);

  // Build headers - CRITICAL: Don't use spam-triggering headers
  const headers: Array<[string, string]> = [
    ["Date", date],
    ["Message-ID", messageId],
    ["To", payload.to],
    ["From", userEmail],
    ["Reply-To", userEmail], // Important: Set Reply-To to user's email
    ["Subject", payload.subject],
    ["MIME-Version", "1.0"],
  ];

  if (payload.cc?.length) {
    headers.push(["Cc", payload.cc.join(", ")]);
  }
  if (payload.bcc?.length) {
    headers.push(["Bcc", payload.bcc.join(", ")]);
  }

  // Add reply headers if this is a reply
  if (payload.inReplyTo) {
    headers.push(["In-Reply-To", payload.inReplyTo]);
  }
  if (payload.references) {
    headers.push(["References", payload.references]);
  }

  // Note: List-Unsubscribe header removed temporarily to avoid spam triggers
  // The placeholder URLs ({{email}}, {{token}}) were triggering Gmail's phishing detection
  // TODO: Re-add when proper unsubscribe endpoint is implemented with real email/token values

  // Add X- headers for better deliverability (but avoid spam triggers)
  headers.push(["X-Mailer", "TaskForce Campaign Manager"]);
  
  // Only suppress auto-responses if this is a campaign (not personal emails)
  if (payload.isCampaign) {
    headers.push(["X-Auto-Response-Suppress", "All"]);
  }

  // Add custom headers if provided
  if (payload.headers) {
    for (const [key, value] of Object.entries(payload.headers)) {
      // Don't override critical headers
      const lowerKey = key.toLowerCase();
      if (
        !["to", "from", "subject", "content-type", "mime-version", "date", "message-id", "reply-to"].includes(
          lowerKey,
        )
      ) {
        headers.push([key, value]);
      }
    }
  }

  // Build multipart message with both HTML and plain text
  const boundary = `----=_Part_${Date.now()}_${randomBytes(8).toString("hex")}`;
  
  const multipartBody = [
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    bodyText,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    bodyHtmlWithSignature,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const message = `${headers.map(([key, value]) => `${key}: ${value}`).join("\r\n")}\r\n${multipartBody}`;

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


