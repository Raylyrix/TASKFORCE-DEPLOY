import type { Express } from "express";
import type { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      apiKeyUser?: {
        userId: string;
        permissions: string[];
      };
      currentUser?: User;
    }
  }
}
