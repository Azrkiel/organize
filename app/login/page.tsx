import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Organize" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Organize</h1>
          <p className="text-sm text-muted-foreground">Sign in with your email.</p>
        </div>
        {error === "link" && (
          <p className="text-sm text-destructive">
            That link didn&apos;t work here (open it in the same browser you requested it from).
            Request a new one, or use the 6-digit code instead.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
