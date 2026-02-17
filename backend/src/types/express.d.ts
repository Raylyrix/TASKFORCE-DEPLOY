import "express-serve-static-core";

declare global {
  namespace Express {
    interface Request {
      query: Record<string, string | undefined>;
      params: Record<string, string>;
    }
  }
}
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
