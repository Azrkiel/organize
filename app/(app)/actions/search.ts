"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sanitizeHeadline } from "@/lib/search-snippet";

export type SearchResult = {
  kind: "note" | "task";
  id: string;
  title: string;
  snippet: string | null;
  courseId: string | null;
};

const querySchema = z.string().trim().min(1).max(200);

/** Ranked notes (full text) + title-matched tasks, via the `search_all` SQL function (PLAN.md Phase 6 task 2). */
export async function searchAll(query: string): Promise<SearchResult[]> {
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_all", { q: parsed.data });
  if (error || !data) return [];

  return data.map((row) => ({
    kind: row.kind as "note" | "task",
    id: row.id,
    title: row.title,
    snippet: row.snippet ? sanitizeHeadline(row.snippet) : null,
    courseId: row.course_id,
  }));
}
