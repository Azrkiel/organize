"use server";

import { getExportData, type ExportData } from "@/lib/server/export";

/** Fetches everything the client needs to build the export ZIP itself (no server-side zipping — free tier, no server time). */
export async function getExportPayload(): Promise<ExportData> {
  return getExportData();
}
