import { getAttachmentStorageBytes } from "@/lib/server/storage-usage";
import { formatBytes } from "@/lib/format-bytes";
import { createClient } from "@/lib/supabase/server";
import { getIntegration } from "@/lib/server/integrations";
import { buttonVariants } from "@/components/ui/button";
import { DisconnectButton } from "@/components/settings/disconnect-button";
import { DigestForm } from "@/components/settings/digest-form";
import { ExportButton } from "@/components/settings/export-button";
import { LectureAudioCleanup } from "@/components/settings/lecture-audio-cleanup";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

// Free-tier Supabase Storage is ~1 GB total (shared with everything else in the project).
const STORAGE_BUDGET_BYTES = 1024 * 1024 * 1024;

const GOOGLE_STATUS_MESSAGES: Record<string, { text: string; tone: "success" | "error" }> = {
  connected: { text: "Google Calendar connected.", tone: "success" },
  cancelled: { text: "Google connection cancelled.", tone: "error" },
  error: { text: "Couldn't connect Google Calendar. Try again.", tone: "error" },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { google: googleStatus } = await searchParams;
  const bytes = await getAttachmentStorageBytes();
  const percent = bytes === null ? 0 : Math.min(100, Math.round((bytes / STORAGE_BUDGET_BYTES) * 100));

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  // getIntegration needs the service-role client and TOKEN_ENCRYPTION_KEY — if either is missing
  // in this environment, that's a config problem the owner needs to see, but it shouldn't take
  // the rest of this page (appearance, storage, digest, export) down with it.
  let google: Awaited<ReturnType<typeof getIntegration>> = null;
  let googleCheckFailed = false;
  if (auth.user) {
    try {
      google = await getIntegration(auth.user.id, "google");
    } catch (err) {
      console.error("Failed to look up the Google integration", err);
      googleCheckFailed = true;
    }
  }

  const { data: settings } = auth.user
    ? await supabase.from("settings").select("digest_enabled, digest_email").eq("user_id", auth.user.id).single()
    : { data: null };

  const statusMessage = googleStatus ? GOOGLE_STATUS_MESSAGES[googleStatus] : undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {statusMessage && (
        <p
          className={cn(
            "rounded-lg border p-3 text-sm",
            statusMessage.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {statusMessage.text}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Appearance</h2>
        <ThemeToggle />
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Calendar sync</h2>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Google Calendar</p>
            <p className="text-sm text-muted-foreground">
              {googleCheckFailed
                ? "Couldn't check connection status right now."
                : google
                  ? `Connected as ${google.accountEmail ?? "unknown account"}`
                  : "Not connected"}
            </p>
          </div>
          {!googleCheckFailed &&
            (google ? (
              <DisconnectButton provider="google" />
            ) : (
              <a href="/api/integrations/google/connect" className={cn(buttonVariants({ variant: "outline" }))}>
                Connect
              </a>
            ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <div>
            <p className="text-sm font-medium">Outlook</p>
            <p className="text-sm text-muted-foreground">
              Not connected. Blocked by UVA&apos;s Microsoft admin policy — pending an IT request.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Attachment storage</h2>
        {bytes === null ? (
          <p className="text-sm text-muted-foreground">Sign in to see your storage usage.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {formatBytes(bytes)} of the ~1 GB free tier used ({percent}%)
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </>
        )}
      </div>

      <LectureAudioCleanup />

      {process.env.RESEND_API_KEY && auth.user && (
        <div className="space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Daily digest</h2>
          <DigestForm
            accountEmail={auth.user.email ?? ""}
            initialEnabled={settings?.digest_enabled ?? false}
            initialEmail={settings?.digest_email ?? ""}
          />
        </div>
      )}

      <div className="space-y-2 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Export</h2>
        <p className="text-sm text-muted-foreground">
          Download every note as Markdown, in its course/folder structure, plus attachments — a ZIP built
          right in your browser.
        </p>
        <ExportButton />
      </div>
    </div>
  );
}
