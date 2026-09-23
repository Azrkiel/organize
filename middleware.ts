import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets, PWA files, and cron routes (Vercel Cron has no session). The manifest's
  // icons (icon-192, icon-512, apple-icon) must be reachable unauthenticated — that's exactly
  // how a browser/OS fetches them to build the "Add to Home Screen" install prompt.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon-192|icon-512|apple-icon|api/cron/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
