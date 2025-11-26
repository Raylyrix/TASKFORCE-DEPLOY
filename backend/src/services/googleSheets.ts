import { google } from "googleapis";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { googleAuthService } from "./googleAuth";

const sheetImportSchema = z.object({
  sheetUrl: z.string().url(),
  worksheetGid: z
    .union([z.string(), z.number()])
    .transform((value) => value.toString())
    .optional(),
  headerRowIndex: z.number().int().min(0).default(0),
});

type SheetImportInput = z.infer<typeof sheetImportSchema>;

const parseSheetUrl = (sheetUrl: string) => {
  const url = new URL(sheetUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const docsIndex = segments.findIndex((segment) => segment === "d");

  if (docsIndex === -1 || !segments[docsIndex + 1]) {
    throw new Error("Unable to parse spreadsheet ID from provided URL");
  }

  const spreadsheetId = segments[docsIndex + 1];
  const gidFromHash = url.hash.match(/gid=(\d+)/)?.[1];
  const gidFromQuery = url.searchParams.get("gid");

  const worksheetGid = gidFromHash ?? gidFromQuery ?? undefined;

  return { spreadsheetId, worksheetGid };
};

const toRecordObjects = (headers: string[], rows: string[][], headerRowIndex: number) => {
  const sanitizedHeaders = headers.map((header, index) =>
    header && header.trim().length > 0 ? header.trim() : `Column_${index + 1}`,
  );

  const dataRows = rows.slice(headerRowIndex + 1);

  return dataRows.map((row) => {
    const record: Record<string, string> = {};
    sanitizedHeaders.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
};

export const importSheetForUser = async (userId: string, input: SheetImportInput) => {
  const parsedInput = sheetImportSchema.parse(input);
  const { spreadsheetId, worksheetGid: derivedGid } = parseSheetUrl(parsedInput.sheetUrl);
  const worksheetGid = parsedInput.worksheetGid ?? derivedGid;

  const authClient = await googleAuthService.getAuthorizedClientForUser(userId);

  const sheets = google.sheets({
    version: "v4",
    auth: authClient,
  });

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });

  const spreadsheetTitle = metadata.data.properties?.title ?? "Untitled spreadsheet";
  const targetSheet =
    metadata.data.sheets?.find((sheet) => {
      if (!worksheetGid) {
        return sheet.properties?.index === 0;
      }
      return sheet.properties?.sheetId?.toString() === worksheetGid;
    }) ?? metadata.data.sheets?.[0];

  if (!targetSheet || !targetSheet.properties?.title) {
    throw new Error("Unable to locate requested worksheet in spreadsheet");
  }

  const worksheetTitle = targetSheet.properties.title;
  const worksheetId = targetSheet.properties.sheetId?.toString() ?? undefined;
  const range = `'${worksheetTitle}'`;

  const valuesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = valuesResponse.data.values ?? [];

  if (rows.length === 0) {
    throw new Error("The selected worksheet does not contain any rows");
  }

  const headerRow = rows[parsedInput.headerRowIndex] ?? [];
  const columnMetadata = headerRow.map((header, index) => ({
    name: header ?? "",
    index,
  }));

  const sheetSource = await prisma.sheetSource.create({
    data: {
      userId,
      title: spreadsheetTitle,
      spreadsheetId,
      worksheetId: worksheetId ?? null,
      columns: columnMetadata,
    },
  });

  const records = toRecordObjects(headerRow, rows, parsedInput.headerRowIndex);

  logger.info(
    {
      userId,
      spreadsheetId,
      worksheetId,
      rowsImported: records.length,
    },
    "Imported Google Sheet data",
  );

  return {
    sheetSource,
    headers: headerRow,
    records,
  };
};

export const sheetsService = {
  importSheetForUser,
};


