import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Course, Folder } from "@/lib/types";

export type SidebarData = {
  courses: Course[];
  archivedCourses: Course[];
  foldersByCourse: Record<string, Folder[]>;
};

const EMPTY: SidebarData = { courses: [], archivedCourses: [], foldersByCourse: {} };

/** Every course (split active/archived) and every folder, for the sidebar tree. Empty (not thrown) if signed out. */
export async function getSidebarData(): Promise<SidebarData> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return EMPTY;

  const [{ data: allCourses }, { data: folders }] = await Promise.all([
    supabase.from("courses").select("*").order("position"),
    supabase.from("folders").select("*").order("position"),
  ]);

  const courses = (allCourses ?? []).filter((c) => !c.archived);
  const archivedCourses = (allCourses ?? []).filter((c) => c.archived);

  const foldersByCourse: Record<string, Folder[]> = {};
  for (const folder of folders ?? []) {
    (foldersByCourse[folder.course_id] ??= []).push(folder);
  }

  return { courses, archivedCourses, foldersByCourse };
}
