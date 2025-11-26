import type { RequestHandler } from "express";

import { prisma } from "../lib/prisma";

export const requireUser: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.header("x-user-id")?.trim();

    if (!userId) {
      res.status(401).json({
        error: "Missing X-User-Id header",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(401).json({
        error: "User not found",
      });
      return;
    }

    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
};


