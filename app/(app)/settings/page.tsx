import { getAttachmentStorageBytes } from "@/lib/server/storage-usage";
import { formatBytes } from "@/lib/format-bytes";

// Free-tier Supabase Storage is ~1 GB total (shared with everything else in the project).
const STORAGE_BUDGET_BYTES = 1024 * 1024 * 1024;

export default async function SettingsPage() {
  const bytes = await getAttachmentStorageBytes();
  const percent = bytes === null ? 0 : Math.min(100, Math.round((bytes / STORAGE_BUDGET_BYTES) * 100));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

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

      <p className="text-sm text-muted-foreground">
        Calendar sync, the daily digest, and export options show up here in later phases.
      </p>
    </div>
  );
}
