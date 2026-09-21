import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TimezoneSync } from "@/components/timezone-sync";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <AppShell email={data.user.email ?? ""}>
      <TimezoneSync />
      {children}
    </AppShell>
  );
}
