import Link from "next/link";

export const metadata = { title: "Database unavailable · Organize" };

export default async function PausedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const config = reason === "config";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {config ? "Setup needed" : "Database is waking up"}
        </h1>
        {config ? (
          <p className="text-sm text-muted-foreground">
            Supabase keys are missing. Copy <code>.env.example</code> to <code>.env.local</code>, fill in the
            values, and restart the dev server.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            The Supabase free tier pauses projects after about a week of inactivity. Open your Supabase
            dashboard, click <strong>Restore project</strong>, wait a minute, then try again.
          </p>
        )}
        <Link
          href="/"
          prefetch={false}
          className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Try again
        </Link>
      </div>
    </main>
  );
}
