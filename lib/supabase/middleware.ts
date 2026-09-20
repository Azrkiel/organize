import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, MissingSupabaseEnvError } from "./env";

const PUBLIC_PATHS = ["/login", "/auth", "/paused"];

function redirectTo(request: NextRequest, pathname: string, search = "") {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  return NextResponse.redirect(url);
}

// Refreshes the session cookie, sends signed-out users to /login, and sends users
// to /paused when Supabase can't be reached (e.g. a paused free-tier project).
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  try {
    const { url, anonKey } = getSupabaseEnv();
    let response = NextResponse.next({ request });

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    // getUser() revalidates the token with Supabase; getSession() would trust the cookie.
    const { data, error } = await supabase.auth.getUser();

    const unreachable =
      error && (error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500);
    if (unreachable) return pathname === "/paused" ? response : redirectTo(request, "/paused");

    if (!data.user && !isPublic) return redirectTo(request, "/login");
    if (data.user && pathname === "/login") return redirectTo(request, "/");
    return response;
  } catch (err) {
    if (pathname === "/paused") return NextResponse.next({ request });
    const reason = err instanceof MissingSupabaseEnvError ? "?reason=config" : "";
    return redirectTo(request, "/paused", reason);
  }
}
