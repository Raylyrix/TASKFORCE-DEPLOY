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
  try {
    const url = new URL(sheetUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    
    // Try to find spreadsheet ID in different URL formats:
    // 1. /spreadsheets/d/{spreadsheetId}/...
    // 2. /d/{spreadsheetId}/...
    // 3. /spreadsheets/d/{spreadsheetId}
    // 4. /d/{spreadsheetId}
    let spreadsheetId: string | undefined;
    
    const dIndex = segments.findIndex((segment) => segment === "d");
    if (dIndex !== -1 && segments[dIndex + 1]) {
      spreadsheetId = segments[dIndex + 1];
    } else {
      // Try alternative: look for a long alphanumeric string that looks like a spreadsheet ID
      // Google Sheets IDs are typically 44 characters long
      const potentialId = segments.find((seg) => seg.length > 30 && /^[a-zA-Z0-9_-]+$/.test(seg));
      if (potentialId) {
        spreadsheetId = potentialId;
      }
    }

    if (!spreadsheetId) {
      throw new Error(
        `Unable to parse spreadsheet ID from URL. Please ensure you're using a valid Google Sheets URL format:\n` +
        `- https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit\n` +
        `- https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit#gid={GID}\n` +
        `Received URL: ${sheetUrl}`
      );
    }

    // Extract worksheet GID from hash or query params
    const gidFromHash = url.hash.match(/[#&]gid=(\d+)/)?.[1];
    const gidFromQuery = url.searchParams.get("gid");

    const worksheetGid = gidFromHash ?? gidFromQuery ?? undefined;

    logger.info(
      { spreadsheetId, worksheetGid, originalUrl: sheetUrl },
      "Parsed Google Sheets URL"
    );

    return { spreadsheetId, worksheetGid };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("Invalid URL")) {
      throw new Error(
        `Invalid URL format. Please provide a valid Google Sheets URL.\n` +
        `Example: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit\n` +
        `Received: ${sheetUrl}`
      );
    }
    throw error;
  }
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

  let metadata;
  try {
    logger.info({ userId, spreadsheetId }, "Fetching spreadsheet metadata");
    metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
    });
    logger.info(
      { userId, spreadsheetId, title: metadata.data.properties?.title },
      "Successfully fetched spreadsheet metadata"
    );
  } catch (error: unknown) {
    logger.error(
      { userId, spreadsheetId, error: error instanceof Error ? error.message : String(error) },
      "Failed to fetch spreadsheet metadata"
    );
    
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === 404) {
        throw new Error(
          `Spreadsheet not found (ID: ${spreadsheetId}). Please ensure:\n` +
          `1. The spreadsheet URL is correct\n` +
          `2. The spreadsheet exists and hasn't been deleted\n` +
          `3. You have access to view the spreadsheet`
        );
      }
      if (error.code === 403) {
        throw new Error(
          `Access denied to spreadsheet (ID: ${spreadsheetId}). Please ensure:\n` +
          `1. You have permission to view this spreadsheet\n` +
          `2. The Google account you connected has the necessary permissions\n` +
          `3. Try re-authenticating to refresh permissions`
        );
      }
      if (error.code === 401) {
        throw new Error(
          `Authentication failed. Please reconnect your Google account to refresh permissions.`
        );
      }
    }
    
    // Re-throw with more context if it's an Error
    if (error instanceof Error) {
      throw new Error(`Failed to import spreadsheet: ${error.message}`);
    }
    throw error;
  }

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

  let valuesResponse;
  try {
    logger.info({ userId, spreadsheetId, worksheetTitle, range }, "Fetching worksheet values");
    valuesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    logger.info(
      { userId, spreadsheetId, worksheetTitle, rowCount: valuesResponse.data.values?.length ?? 0 },
      "Successfully fetched worksheet values"
    );
  } catch (error: unknown) {
    logger.error(
      {
        userId,
        spreadsheetId,
        worksheetTitle,
        range,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to fetch worksheet values"
    );
    
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === 404) {
        throw new Error(
          `Worksheet "${worksheetTitle}" not found in the spreadsheet. Please check:\n` +
          `1. The worksheet name is correct\n` +
          `2. The worksheet hasn't been deleted\n` +
          `3. You're using the correct GID if specifying a specific worksheet`
        );
      }
      if (error.code === 403) {
        throw new Error(
          `Access denied to worksheet "${worksheetTitle}". Please ensure you have permission to view this worksheet.`
        );
      }
      if (error.code === 400) {
        throw new Error(
          `Invalid request for worksheet "${worksheetTitle}". The range may be invalid or the worksheet may be corrupted.`
        );
      }
    }
    
    if (error instanceof Error) {
      throw new Error(`Failed to fetch worksheet data: ${error.message}`);
    }
    throw error;
  }

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


