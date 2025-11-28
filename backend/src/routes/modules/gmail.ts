import { Router } from "express";
import { google } from "googleapis";
import { z } from "zod";

import { cache, cacheKeys, CACHE_TTL } from "../../lib/cache";
import { requireUser } from "../../middleware/requireUser";
import { googleAuthService } from "../../services/googleAuth";

export const gmailRouter = Router();

gmailRouter.get("/labels", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cacheKey = cacheKeys.emailLabels(currentUser.id);

    // Try cache first (fail silently if cache unavailable)
    let cached: { labels: Array<{
      id: string;
      name: string;
      type: "system" | "user";
      color: string | null;
      messageListVisibility: string | null;
      labelListVisibility: string | null;
    }> } | null = null;

    try {
      cached = await cache.get<{ labels: Array<{
        id: string;
        name: string;
        type: "system" | "user";
        color: string | null;
        messageListVisibility: string | null;
        labelListVisibility: string | null;
      }> }>(cacheKey);
    } catch (error) {
      // Cache error is non-critical, continue without cache
    }

    if (cached) {
      return res.status(200).json(cached);
    }

    const client = await googleAuthService.getAuthorizedClientForUser(currentUser.id);
    const gmail = google.gmail({ version: "v1", auth: client });

    const { data } = await gmail.users.labels.list({ userId: "me" });
    const labels = (data.labels ?? []).map((label) => ({
      id: label.id ?? "",
      name: label.name ?? "",
      type: (label.type as "system" | "user") ?? "user",
      color: label.color?.backgroundColor ?? null,
      messageListVisibility: label.messageListVisibility ?? null,
      labelListVisibility: label.labelListVisibility ?? null,
    }));

    const result = { labels };

    // Cache the result (fail silently if cache unavailable)
    try {
      await cache.set(cacheKey, result, CACHE_TTL.EMAIL_LABELS);
    } catch (error) {
      // Cache error is non-critical, continue
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

gmailRouter.get("/messages", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const pageToken = typeof req.query.pageToken === "string" ? req.query.pageToken : undefined;
    const maxResults = Number.parseInt(typeof req.query.maxResults === "string" ? req.query.maxResults : "50", 10);
    const query = typeof req.query.q === "string" ? req.query.q : undefined;

    const client = await googleAuthService.getAuthorizedClientForUser(currentUser.id);
    const gmail = google.gmail({ version: "v1", auth: client });

    // Default to inbox if no query specified
    const finalQuery = query || "in:inbox";

    const listParams: { userId: string; maxResults: number; pageToken?: string; q?: string } = {
      userId: "me",
      maxResults: Math.min(maxResults, 500),
    };

    if (pageToken) {
      listParams.pageToken = pageToken;
    }

    if (finalQuery) {
      listParams.q = finalQuery;
    }

    const { data } = await gmail.users.messages.list({
      ...listParams,
    });

    // Fetch metadata for each message to get subject and from
    const messagesWithMetadata = await Promise.all(
      (data.messages ?? []).map(async (msg: { id?: string | null }) => {
        if (!msg.id) return null;
        try {
          const msgData = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"],
          });

          const headers = (msgData.data.payload?.headers ?? []).reduce(
            (acc, header) => {
              if (header.name && header.value) {
                acc[header.name.toLowerCase()] = header.value;
              }
              return acc;
            },
            {} as Record<string, string>,
          );

          return {
            id: msg.id ?? "",
            threadId: msgData.data.threadId ?? "",
            subject: headers.subject || "(No Subject)",
            from: headers.from || "Unknown",
            date: headers.date || undefined,
            snippet: msgData.data.snippet || "",
            labelIds: msgData.data.labelIds ?? [],
          };
        } catch (error) {
          // If fetching metadata fails, return basic info
          return {
            id: msg.id ?? "",
            threadId: "",
            subject: "(Error loading subject)",
            from: "Unknown",
            snippet: "",
            labelIds: [],
          };
        }
      }),
    );

    const messages = messagesWithMetadata.filter((msg: any): msg is NonNullable<typeof msg> => msg !== null);

    res.status(200).json({
      messages,
      nextPageToken: data.nextPageToken ?? undefined,
      resultSizeEstimate: data.resultSizeEstimate ?? 0,
    });
  } catch (error) {
    next(error);
  }
});

// Get thread with all messages
gmailRouter.get("/threads/:threadId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { threadId } = req.params;

    const client = await googleAuthService.getAuthorizedClientForUser(currentUser.id);
    const gmail = google.gmail({ version: "v1", auth: client });

    const { data } = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const messages = (data.messages ?? []).map((msg) => {
      const headers = (msg.payload?.headers ?? []).reduce(
        (acc, header) => {
          if (header.name && header.value) {
            acc[header.name.toLowerCase()] = header.value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );

      let bodyText = "";
      let bodyHtml = "";
      const attachments: Array<{
        filename: string;
        mimeType: string;
        size: number;
        attachmentId: string;
      }> = [];

      const extractBody = (part: any) => {
        if (part.body?.data) {
          const content = Buffer.from(part.body.data, "base64").toString("utf-8");
          if (part.mimeType === "text/plain") {
            bodyText = content;
          } else if (part.mimeType === "text/html") {
            bodyHtml = content;
          }
        }

        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType || "application/octet-stream",
            size: part.body.size || 0,
            attachmentId: part.body.attachmentId,
          });
        }

        if (part.parts) {
          part.parts.forEach(extractBody);
        }
      };

      if (msg.payload) {
        extractBody(msg.payload);
      }

      return {
        id: msg.id ?? "",
        threadId: msg.threadId ?? "",
        snippet: msg.snippet ?? "",
        payload: {
          headers,
          body: {
            text: bodyText,
            html: bodyHtml,
          },
          attachments,
        },
        internalDate: msg.internalDate ? Number.parseInt(msg.internalDate, 10) : undefined,
        labelIds: msg.labelIds ?? [],
      };
    });

    // Sort messages by date
    messages.sort((a, b) => {
      const dateA = a.internalDate || 0;
      const dateB = b.internalDate || 0;
      return dateA - dateB;
    });

    res.status(200).json({
      threadId: data.id ?? "",
      messages,
      historyId: data.historyId,
    });
  } catch (error) {
    next(error);
  }
});

gmailRouter.get("/messages/:messageId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { messageId } = req.params;

    const client = await googleAuthService.getAuthorizedClientForUser(currentUser.id);
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

    // Extract body content and attachments
    let bodyText = "";
    let bodyHtml = "";
    const attachments: Array<{
      filename: string;
      mimeType: string;
      size: number;
      attachmentId: string;
    }> = [];

    const extractBody = (part: any) => {
      if (part.body?.data) {
        const content = Buffer.from(part.body.data, "base64").toString("utf-8");
        if (part.mimeType === "text/plain") {
          bodyText = content;
        } else if (part.mimeType === "text/html") {
          bodyHtml = content;
        }
      }

      // Extract attachments
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || "application/octet-stream",
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
        });
      }

      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };

    if (data.payload) {
      extractBody(data.payload);
    }

    res.status(200).json({
      id: data.id ?? "",
      threadId: data.threadId ?? "",
      snippet: data.snippet ?? "",
      payload: {
        headers,
        body: {
          text: bodyText,
          html: bodyHtml,
        },
        attachments,
      },
      internalDate: data.internalDate ? Number.parseInt(data.internalDate, 10) : undefined,
      sizeEstimate: data.sizeEstimate,
      labelIds: data.labelIds ?? [],
    });
  } catch (error) {
    next(error);
  }
});

// Email actions (modify, archive, delete, star, etc.)
const emailActionSchema = z.object({
  action: z.enum(["read", "unread", "archive", "unarchive", "delete", "trash", "star", "unstar"]),
  labelIds: z.array(z.string()).optional(),
});

gmailRouter.post("/messages/:messageId/actions", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { messageId } = req.params;
    const payload = emailActionSchema.parse(req.body ?? {});

    const client = await googleAuthService.getAuthorizedClientForUser(currentUser.id);
    const gmail = google.gmail({ version: "v1", auth: client });

    let result;
    const addLabelIds: string[] = [];
    const removeLabelIds: string[] = [];

    switch (payload.action) {
      case "read":
        removeLabelIds.push("UNREAD");
        break;
      case "unread":
        addLabelIds.push("UNREAD");
        break;
      case "archive":
        removeLabelIds.push("INBOX");
        break;
      case "unarchive":
        addLabelIds.push("INBOX");
        break;
      case "delete":
        result = await gmail.users.messages.delete({
          userId: "me",
          id: messageId,
        });
        break;
      case "trash":
        result = await gmail.users.messages.trash({
          userId: "me",
          id: messageId,
        });
        break;
      case "star":
        addLabelIds.push("STARRED");
        break;
      case "unstar":
        removeLabelIds.push("STARRED");
        break;
    }

    // Apply label changes if any
    if (addLabelIds.length > 0 || removeLabelIds.length > 0 || payload.labelIds) {
      const finalAddLabelIds = [...addLabelIds, ...(payload.labelIds ?? [])];
      result = await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: finalAddLabelIds.length > 0 ? finalAddLabelIds : undefined,
          removeLabelIds: removeLabelIds.length > 0 ? removeLabelIds : undefined,
        },
      });
    }

    res.status(200).json({ success: true, messageId });
  } catch (error) {
    next(error);
  }
});

// Bulk email actions
const bulkActionSchema = z.object({
  messageIds: z.array(z.string()).min(1),
  action: z.enum(["read", "unread", "archive", "unarchive", "delete", "trash", "star", "unstar"]),
  labelIds: z.array(z.string()).optional(),
});

gmailRouter.post("/messages/bulk-actions", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = bulkActionSchema.parse(req.body ?? {});

    const client = await googleAuthService.getAuthorizedClientForUser(currentUser.id);
    const gmail = google.gmail({ version: "v1", auth: client });

    const addLabelIds: string[] = [];
    const removeLabelIds: string[] = [];

    switch (payload.action) {
      case "read":
        removeLabelIds.push("UNREAD");
        break;
      case "unread":
        addLabelIds.push("UNREAD");
        break;
      case "archive":
        removeLabelIds.push("INBOX");
        break;
      case "unarchive":
        addLabelIds.push("INBOX");
        break;
      case "delete":
        // Delete messages one by one
        await Promise.all(
          payload.messageIds.map((id) =>
            gmail.users.messages.delete({
              userId: "me",
              id,
            }),
          ),
        );
        res.status(200).json({ success: true, processed: payload.messageIds.length });
        return;
      case "trash":
        // Trash messages one by one
        await Promise.all(
          payload.messageIds.map((id) =>
            gmail.users.messages.trash({
              userId: "me",
              id,
            }),
          ),
        );
        res.status(200).json({ success: true, processed: payload.messageIds.length });
        return;
      case "star":
        addLabelIds.push("STARRED");
        break;
      case "unstar":
        removeLabelIds.push("STARRED");
        break;
    }

    // Apply label changes to all messages
    if (addLabelIds.length > 0 || removeLabelIds.length > 0 || payload.labelIds) {
      const finalAddLabelIds = [...addLabelIds, ...(payload.labelIds ?? [])];
      await Promise.all(
        payload.messageIds.map((id) =>
          gmail.users.messages.modify({
            userId: "me",
            id,
            requestBody: {
              addLabelIds: finalAddLabelIds.length > 0 ? finalAddLabelIds : undefined,
              removeLabelIds: removeLabelIds.length > 0 ? removeLabelIds : undefined,
            },
          }),
        ),
      );
    }

    res.status(200).json({ success: true, processed: payload.messageIds.length });
  } catch (error) {
    next(error);
  }
});

// Reply to email
const replySchema = z.object({
  text: z.string().min(1),
  html: z.string().optional(),
  replyAll: z.boolean().optional().default(false),
});

gmailRouter.post("/messages/:messageId/reply", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { messageId } = req.params;
    const payload = replySchema.parse(req.body ?? {});

    const client = await googleAuthService.getAuthorizedClientForUser(currentUser.id);
    const gmail = google.gmail({ version: "v1", auth: client });

    // Get original message to extract thread ID and headers
    const originalMessage = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "To", "Cc", "Message-ID"],
    });

    const headers = (originalMessage.data.payload?.headers ?? []).reduce(
      (acc, header) => {
        if (header.name && header.value) {
          acc[header.name.toLowerCase()] = header.value;
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    // Build reply headers
    const replyHeaders: string[] = [];
    const subject = headers.subject?.startsWith("Re:") ? headers.subject : `Re: ${headers.subject || ""}`;
    replyHeaders.push(`Subject: ${subject}`);

    // Get user's email from profile
    const profile = await gmail.users.getProfile({ userId: "me" });
    const userEmail = profile.data.emailAddress || "";

    if (payload.replyAll) {
      // Reply to all: original sender + all recipients (excluding user's own email)
      const originalFrom = headers.from || "";
      const originalTo = headers.to || "";
      const originalCc = headers.cc || "";
      
      // Extract email addresses from headers (remove display names)
      const extractEmails = (headerValue: string): string[] => {
        if (!headerValue) return [];
        return headerValue
          .split(",")
          .map((addr) => {
            const match = addr.match(/<([^>]+)>/) || addr.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
            return match ? match[1] : addr.trim();
          })
          .filter(Boolean);
      };
      
      const allRecipients = new Set([
        ...extractEmails(originalFrom),
        ...extractEmails(originalTo),
        ...extractEmails(originalCc),
      ]);
      
      // Remove user's own email from recipients
      allRecipients.delete(userEmail.toLowerCase());
      
      const recipientsArray = Array.from(allRecipients);
      if (recipientsArray.length === 0) {
        // Fallback: just reply to original sender
        replyHeaders.push(`To: ${originalFrom}`);
      } else {
        // Original sender goes to To, others to Cc
        const originalSenderEmail = extractEmails(originalFrom)[0] || recipientsArray[0];
        const otherRecipients = recipientsArray.filter((email) => email.toLowerCase() !== originalSenderEmail.toLowerCase());
        
        replyHeaders.push(`To: ${originalSenderEmail}`);
        if (otherRecipients.length > 0) {
          replyHeaders.push(`Cc: ${otherRecipients.join(", ")}`);
        }
      }
    } else {
      // Reply to sender only
      replyHeaders.push(`To: ${headers.from || ""}`);
    }

    replyHeaders.push(`In-Reply-To: ${headers["message-id"] || ""}`);
    replyHeaders.push(`References: ${headers["message-id"] || ""}`);

    // Build email body
    const emailBody = [
      ...replyHeaders,
      "Content-Type: text/html; charset=utf-8",
      "",
      payload.html || payload.text.replace(/\n/g, "<br>"),
    ].join("\n");

    const encodedMessage = Buffer.from(emailBody)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const reply = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        threadId: originalMessage.data.threadId || undefined,
        raw: encodedMessage,
      },
    });

    res.status(200).json({
      success: true,
      messageId: reply.data.id,
      threadId: reply.data.threadId,
    });
  } catch (error) {
    next(error);
  }
});

// Send new email
// Helper to validate comma-separated email addresses
const emailListSchema = z.string().refine(
  (val) => {
    if (!val || val.trim() === "") return true; // Empty is valid (optional)
    const emails = val.split(",").map((e) => e.trim()).filter(Boolean);
    return emails.every((email) => z.string().email().safeParse(email).success);
  },
  { message: "Invalid email address format" }
);

const sendEmailSchema = z.object({
  to: z.string().refine(
    (val) => {
      const emails = val.split(",").map((e) => e.trim()).filter(Boolean);
      return emails.length > 0 && emails.every((email) => z.string().email().safeParse(email).success);
    },
    { message: "Invalid 'to' email address format" }
  ),
  cc: emailListSchema.optional(),
  bcc: emailListSchema.optional(),
  subject: z.string().min(1),
  text: z.string().min(1),
  html: z.string().optional(),
});

gmailRouter.post("/messages/send", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = sendEmailSchema.parse(req.body ?? {});

    const client = await googleAuthService.getAuthorizedClientForUser(currentUser.id);
    const gmail = google.gmail({ version: "v1", auth: client });

    // Get user's email
    const profile = await gmail.users.getProfile({ userId: "me" });
    const userEmail = profile.data.emailAddress || "";

    // Build email headers
    const headers: string[] = [];
    // Clean and format email addresses (support comma-separated)
    const toEmails = payload.to.split(",").map((e) => e.trim()).filter(Boolean).join(", ");
    headers.push(`To: ${toEmails}`);
    if (payload.cc) {
      const ccEmails = payload.cc.split(",").map((e) => e.trim()).filter(Boolean).join(", ");
      headers.push(`Cc: ${ccEmails}`);
    }
    if (payload.bcc) {
      const bccEmails = payload.bcc.split(",").map((e) => e.trim()).filter(Boolean).join(", ");
      headers.push(`Bcc: ${bccEmails}`);
    }
    headers.push(`Subject: ${payload.subject}`);
    headers.push(`From: ${userEmail}`);

    // Build email body
    const emailBody = [
      ...headers,
      "Content-Type: text/html; charset=utf-8",
      "",
      payload.html || payload.text.replace(/\n/g, "<br>"),
    ].join("\n");

    const encodedMessage = Buffer.from(emailBody)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const sentMessage = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    res.status(200).json({
      success: true,
      messageId: sentMessage.data.id,
      threadId: sentMessage.data.threadId,
    });
  } catch (error) {
    next(error);
  }
});

gmailRouter.get("/messages/:messageId/attachments/:attachmentId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { messageId, attachmentId } = req.params;

    const client = await googleAuthService.getAuthorizedClientForUser(currentUser.id);
    const gmail = google.gmail({ version: "v1", auth: client });

    const { data } = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });

    if (!data.data) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    // Decode base64 attachment data
    const attachmentData = Buffer.from(data.data, "base64");

    // Set appropriate headers for download
    res.setHeader("Content-Type", (data as any).mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${req.query.filename || "attachment"}"`);
    res.setHeader("Content-Length", attachmentData.length);

    res.send(attachmentData);
  } catch (error) {
    next(error);
  }
});

