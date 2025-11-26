import { Router } from "express";
import { z } from "zod";

import { requireUser } from "../../middleware/requireUser";
import { sheetsService } from "../../services/googleSheets";

export const sheetsRouter = Router();

const importSchema = z.object({
  sheetUrl: z.string().url(),
  worksheetGid: z.union([z.string(), z.number()]).optional(),
  headerRowIndex: z.number().int().min(0).optional(),
});

sheetsRouter.post("/import", requireUser, async (req, res, next) => {
  try {
    const payload = importSchema.parse(req.body ?? {});

    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await sheetsService.importSheetForUser(req.currentUser.id, {
      sheetUrl: payload.sheetUrl,
      worksheetGid: payload.worksheetGid
        ? payload.worksheetGid.toString()
        : undefined,
      headerRowIndex: payload.headerRowIndex ?? 0,
    });

    res.status(200).json({
      sheetSource: {
        id: result.sheetSource.id,
        title: result.sheetSource.title,
        spreadsheetId: result.sheetSource.spreadsheetId,
        worksheetId: result.sheetSource.worksheetId,
        columns: result.sheetSource.columns,
      },
      headers: result.headers,
      records: result.records,
      importedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

