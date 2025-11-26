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

  if (payload.headers) {
    for (const [key, value] of Object.entries(payload.headers)) {
      headers.push([key, value]);
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


