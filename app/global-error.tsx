"use client";

// Next's file convention: the ultimate fallback, catches an error even in the root layout
// itself. Replaces the whole page, so it has to render its own <html>/<body> — no shared
// styles/fonts from layout.tsx are available here, kept deliberately plain.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Something went wrong</p>
          <button onClick={() => reset()} style={{ fontSize: 14, textDecoration: "underline" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
