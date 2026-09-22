import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TimezoneSync } from "@/components/timezone-sync";
import { createClient } from "@/lib/supabase/server";
import { getSidebarData } from "@/lib/server/sidebar-data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const sidebar = await getSidebarData();

  return (
    <AppShell
      email={data.user.email ?? ""}
      courses={sidebar.courses}
      archivedCourses={sidebar.archivedCourses}
      foldersByCourse={sidebar.foldersByCourse}
    >
      <TimezoneSync />
      {children}
    </AppShell>
  );
}
