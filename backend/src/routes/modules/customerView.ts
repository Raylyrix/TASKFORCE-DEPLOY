import { Router } from "express";
import { z } from "zod";

import { requireUser } from "../../middleware/requireUser";
import { customerViewService } from "../../services/customerView";

export const customerViewRouter = Router();

// Get unified customer view
customerViewRouter.get("/:email", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const email = decodeURIComponent(req.params.email);

    const customerView = await customerViewService.getCustomerView(req.currentUser.id, email);

    res.status(200).json(customerView);
  } catch (error) {
    next(error);
  }
});

// Search contacts
customerViewRouter.get("/search", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const query = typeof req.query.q === "string" ? req.query.q : "";
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;

    if (!query || query.length < 2) {
      res.status(400).json({ error: "Query must be at least 2 characters" });
      return;
    }

    const contacts = await customerViewService.searchContacts(req.currentUser.id, query, limit);

    res.status(200).json({ contacts });
  } catch (error) {
    next(error);
  }
});


