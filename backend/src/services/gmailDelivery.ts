import { randomBytes } from "crypto";
import { google } from "googleapis";

import { AppConfig } from "../config/env";
import { googleAuthService } from "./googleAuth";
import { logger } from "../lib/logger";
import { antiSpamService } from "./antiSpamService";
import { recordBounce, parseBounceFromError, shouldSuppressEmail } from "./bounceService";
import { recordEmailSent, recordEmailDelivered, recordComplaint } from "./reputationService";
import { canSendEmail } from "./warmupService";
import { getOrCreateSendingDomain } from "./domainAuthService";

export type Attachment = {
  filename: string;
  content: string; // Base64-encoded file content
  contentType?: string; // MIME type (e.g., "application/pdf", "image/jpeg") - optional, will be inferred from filename if not provided
  size?: number; // File size in bytes (optional, for validation)
};

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
  attachments?: Attachment[]; // File attachments
  labelIds?: string[]; // Gmail label IDs to apply to the sent message
};

const toBase64Url = (input: string) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

// Clean and decode any corrupted or double-encoded subject lines
const cleanSubjectEncoding = (subject: string): string => {
  if (!subject || typeof subject !== 'string') {
    return '';
  }
  
  // Remove any corrupted RFC 2047 encoding patterns that might cause issues
  // Pattern: =?charset?encoding?text?= (but handle malformed ones)
  let cleaned = subject;
  
  // Remove any malformed encoding patterns (e.g., incomplete =?UTF-8?B?...)
  cleaned = cleaned.replace(/=\?[^?]*\?[^?]*\?[^?=]*$/g, '');
  cleaned = cleaned.replace(/^[^?=]*\?[^?]*\?[^?]*\?=/g, '');
  
  // Try to decode if it's already RFC 2047 encoded
  // Pattern: =?charset?B?base64?= or =?charset?Q?quoted-printable?=
  const rfc2047Pattern = /=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi;
  let decoded = cleaned;
  let match;
  let hasEncoded = false;
  
  while ((match = rfc2047Pattern.exec(cleaned)) !== null) {
    hasEncoded = true;
    try {
      const charset = match[1].toUpperCase();
      const encoding = match[2].toUpperCase();
      const encodedText = match[3];
      
      if (encoding === 'B' && charset === 'UTF-8') {
        // Base64 decode
        const decodedText = Buffer.from(encodedText, 'base64').toString('utf-8');
        decoded = decoded.replace(match[0], decodedText);
      } else if (encoding === 'Q' && charset === 'UTF-8') {
        // Quoted-printable decode (simplified)
        const decodedText = encodedText.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_, hex) => {
          return String.fromCharCode(parseInt(hex, 16));
        });
        decoded = decoded.replace(match[0], decodedText);
      }
    } catch (error) {
      // If decoding fails, keep the original
      logger.warn({ error, subject: cleaned.substring(0, 100) }, 'Failed to decode RFC 2047 subject');
    }
  }
  
  // Remove any remaining control characters and non-printable characters except spaces
  decoded = decoded.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Remove corrupted single-letter URL encoding ONLY (like %P, %Q from corruption)
  // DO NOT touch valid hex pairs like %50, %20, %45 - those could be legitimate
  const corruptedEncodingPattern = /%([A-F])(?![0-9A-Fa-f])/gi;
  decoded = decoded.replace(corruptedEncodingPattern, (match, letter) => {
    // Just keep the letter, remove the %
    return letter;
  });
  
  // Also clean up obvious corruption patterns
  decoded = decoded.replace(/%%/g, '%'); // Double % is corruption
  decoded = decoded.replace(/%(?![0-9A-Fa-f]{2}|[A-Fa-f](?![0-9A-Fa-f]))/g, ''); // % not followed by valid pattern
  
  return decoded.trim();
};

// Encode subject line for RFC 2047 (handles non-ASCII characters like bullets, emojis, etc.)
const encodeSubject = (subject: string): string => {
  if (!subject || typeof subject !== 'string') {
    return '';
  }
  
  // First, clean any corrupted encoding
  const cleaned = cleanSubjectEncoding(subject);
  
  // Check if subject is already RFC 2047 encoded (after cleaning)
  const alreadyEncoded = /=\?[^?]+\?[BQ]\?[^?]+\?=/i.test(cleaned);
  if (alreadyEncoded) {
    // Already encoded, return as-is (but cleaned)
    return cleaned;
  }
  
  // Check if subject contains non-ASCII characters
  const hasNonAscii = /[^\x00-\x7F]/.test(cleaned);
  
  if (!hasNonAscii) {
    return cleaned;
  }
  
  // Encode using RFC 2047 format: =?charset?encoding?encoded-text?=
  // Use UTF-8 and base64 encoding
  try {
    const encoded = Buffer.from(cleaned, 'utf-8').toString('base64');
    // Split into chunks of 75 characters (RFC 2047 limit per encoded-word)
    const chunks: string[] = [];
    for (let i = 0; i < encoded.length; i += 75) {
      chunks.push(encoded.slice(i, i + 75));
    }
    
    // Join chunks with spaces and wrap each in =?UTF-8?B?...?=
    return chunks.map(chunk => `=?UTF-8?B?${chunk}?=`).join(' ');
  } catch (error) {
    logger.error({ error, subject: cleaned.substring(0, 100) }, 'Failed to encode subject, returning cleaned version');
    return cleaned;
  }
};

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

// Gmail attachment size limits
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB per attachment
const MAX_TOTAL_MESSAGE_SIZE = 25 * 1024 * 1024; // 25MB total message size

// Validate attachments
const validateAttachments = (attachments: Attachment[]): void => {
  if (!attachments || attachments.length === 0) {
    return;
  }

  let totalSize = 0;

  for (const attachment of attachments) {
    // Calculate size from base64 content if not provided
    const size = attachment.size ?? (attachment.content.length * 3) / 4;

    if (size > MAX_ATTACHMENT_SIZE) {
      throw new Error(
        `Attachment "${attachment.filename}" exceeds the maximum size of ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB`
      );
    }

    totalSize += size;
  }

  if (totalSize > MAX_TOTAL_MESSAGE_SIZE) {
    throw new Error(
      `Total attachment size (${(totalSize / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of ${MAX_TOTAL_MESSAGE_SIZE / 1024 / 1024}MB`
    );
  }
};

// Get MIME type from filename
const getContentType = (filename: string, providedType?: string): string => {
  if (providedType) {
    return providedType;
  }

  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    txt: "text/plain",
    csv: "text/csv",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
  };

  return mimeTypes[ext || ""] || "application/octet-stream";
};

export const sendEmailViaGmail = async (payload: SendEmailInput) => {
  // Validate attachments if provided
  if (payload.attachments && payload.attachments.length > 0) {
    validateAttachments(payload.attachments);
  }
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

  // Extract domain from email
  const domain = userEmail.split("@")[1] || "";
  
  // Get or create sending domain
  const sendingDomain = await getOrCreateSendingDomain(payload.userId, domain);

  // Check if email should be suppressed (too many bounces)
  const shouldSuppress = await shouldSuppressEmail(payload.to, sendingDomain.id);
  if (shouldSuppress) {
    throw new Error(`Email ${payload.to} is suppressed due to previous bounces`);
  }

  // Check warm-up limits if domain is in warm-up
  if (payload.isCampaign) {
    const warmupCheck = await canSendEmail(sendingDomain.id, 1);
    if (!warmupCheck.canSend) {
      throw new Error(`Cannot send email: ${warmupCheck.reason || "Warm-up limit reached"}`);
    }
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

  // Clean and validate subject line to prevent spam
  const cleanedSubject = antiSpamService.cleanSubjectLine(payload.subject);
  
  // Perform spam check and log warnings
  const spamCheck = antiSpamService.checkForSpam({
    subject: cleanedSubject,
    html: bodyHtmlWithSignature,
    text: bodyText,
    from: userEmail,
    to: payload.to,
  });

  if (spamCheck.isSpam) {
    logger.warn(
      {
        userId: payload.userId,
        to: payload.to,
        spamScore: spamCheck.score,
        reasons: spamCheck.reasons,
      },
      "Email flagged as potential spam - sending anyway but user should review",
    );
  }

  // Encode subject line properly for non-ASCII characters (fixes encoding issues like Ã¢Â€Â¢)
  const encodedSubject = encodeSubject(cleanedSubject);
  
  // Build headers - CRITICAL: Don't use spam-triggering headers
  const headers: Array<[string, string]> = [
    ["Date", date],
    ["Message-ID", messageId],
    ["To", payload.to],
    ["From", userEmail],
    ["Reply-To", userEmail], // Important: Set Reply-To to user's email
    ["Subject", encodedSubject], // Use encoded subject to prevent encoding issues
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

  // Add proper unsubscribe headers for better deliverability (only for campaigns)
  // This helps with spam filtering - Gmail prefers emails with unsubscribe options
  if (payload.isCampaign && AppConfig.publicUrl) {
    // Use a simple unsubscribe URL - users can implement proper unsubscribe logic
    const unsubscribeUrl = `${AppConfig.publicUrl}/api/campaigns/unsubscribe?email=${encodeURIComponent(payload.to)}`;
    headers.push(["List-Unsubscribe", `<${unsubscribeUrl}>`]);
    headers.push(["List-Unsubscribe-Post", "List-Unsubscribe=One-Click"]);
  }

  // Add X- headers for better deliverability (but avoid spam triggers)
  headers.push(["X-Mailer", "TaskForce Campaign Manager"]);
  
  // Only suppress auto-responses if this is a campaign (not personal emails)
  if (payload.isCampaign) {
    headers.push(["X-Auto-Response-Suppress", "All"]);
    // Add Precedence header to help with deliverability
    headers.push(["Precedence", "bulk"]);
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

  // Build message body
  let messageBody: string;
  let contentType: string;

  if (payload.attachments && payload.attachments.length > 0) {
    // Multipart/mixed structure: outer boundary for attachments, inner boundary for body
    const outerBoundary = `----=_Part_${Date.now()}_${randomBytes(8).toString("hex")}`;
    const innerBoundary = `----=_Part_${Date.now() + 1}_${randomBytes(8).toString("hex")}`;

    // Build multipart/alternative body (HTML + text)
    const bodyParts = [
      `Content-Type: multipart/alternative; boundary="${innerBoundary}"`,
      "",
      `--${innerBoundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      bodyText,
      "",
      `--${innerBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      bodyHtmlWithSignature,
      "",
      `--${innerBoundary}--`,
    ];

    // Build attachment parts
    const attachmentParts: string[] = [];
    for (const attachment of payload.attachments) {
      const attachmentContentType = getContentType(attachment.filename, attachment.contentType);
      const filename = attachment.filename.replace(/[^\x20-\x7E]/g, ""); // Remove non-ASCII chars for safety
      
      attachmentParts.push(
        `--${outerBoundary}`,
        `Content-Type: ${attachmentContentType}; name="${filename}"`,
        'Content-Disposition: attachment; filename="' + filename + '"',
        "Content-Transfer-Encoding: base64",
        "",
        attachment.content, // Base64 content (already encoded)
        "",
      );
    }

    // Combine body and attachments
    messageBody = [
      `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
      "",
      `--${outerBoundary}`,
      ...bodyParts,
      "",
      ...attachmentParts,
      `--${outerBoundary}--`,
    ].join("\r\n");

    contentType = `multipart/mixed; boundary="${outerBoundary}"`;
  } else {
    // No attachments - use multipart/alternative for HTML + text
    const boundary = `----=_Part_${Date.now()}_${randomBytes(8).toString("hex")}`;
    
    messageBody = [
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

    contentType = `multipart/alternative; boundary="${boundary}"`;
  }

  // Add Content-Type header
  headers.push(["Content-Type", contentType]);

  const message = `${headers.map(([key, value]) => `${key}: ${value}`).join("\r\n")}\r\n${messageBody}`;

  const raw = toBase64Url(message);

  try {
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        threadId: payload.threadId ?? undefined,
      },
    });

    // Apply labels if provided
    if (payload.labelIds && payload.labelIds.length > 0) {
      try {
        await gmail.users.messages.modify({
          userId: "me",
          id: response.data.id ?? "",
          requestBody: {
            addLabelIds: payload.labelIds,
          },
        });
      } catch (labelError: any) {
        // Log but don't fail the send if label application fails
        logger.warn(
          { error: labelError, messageId: response.data.id, labelIds: payload.labelIds },
          "Failed to apply labels to sent message"
        );
      }
    }

    // Record successful send
    if (payload.isCampaign) {
      await recordEmailSent(sendingDomain.id);
      await recordEmailDelivered(sendingDomain.id);
    }

    return {
      id: response.data.id ?? "",
      threadId: response.data.threadId ?? null,
    };
  } catch (error: any) {
    // Handle bounces
    const errorMessage = error.message || String(error);
    const bounceInfo = parseBounceFromError(errorMessage);
    
    // Record bounce
    await recordBounce({
      recipientEmail: payload.to,
      bounceType: bounceInfo.bounceType,
      bounceCategory: bounceInfo.bounceCategory,
      reason: bounceInfo.reason || errorMessage,
      rawResponse: JSON.stringify(error),
      sendingDomainId: sendingDomain.id,
    });

    // Re-throw the error
    throw error;
  }
};

export const gmailDeliveryService = {
  sendEmailViaGmail,
};


