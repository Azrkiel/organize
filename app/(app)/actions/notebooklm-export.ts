"use server";

import { getNotebookLmExportData, type NotebookLmExportData } from "@/lib/server/notebooklm-export";

/** Fetches everything the client needs to build one course's NotebookLM export ZIP itself — no
 * server-side zipping, so this costs no server time (PLAN.md Phase 11 task 2). */
export async function getNotebookLmExportPayload(courseId: string): Promise<NotebookLmExportData | null> {
  return getNotebookLmExportData(courseId);
}
