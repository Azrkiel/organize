import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * A stable, permanent URL a generated note's Markdown image can point at (PLAN.md Phase 12 task
 * 7) — Storage signed URLs expire, but a note's content is stored once and read indefinitely, so
 * embedding a signed URL directly would go dead within the hour. This route re-signs on every
 * request instead. RLS on `lecture_photos` (user_id = auth.uid()) does the access check: the
 * `.maybeSingle()` below simply returns nothing for a photo that isn't this signed-in user's own.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: photo } = await supabase.from("lecture_photos").select("storage_path").eq("id", id).maybeSingle();
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: signed } = await supabase.storage.from("lecture-photos").createSignedUrl(photo.storage_path, SIGNED_URL_TTL_SECONDS);
  if (!signed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.redirect(signed.signedUrl);
}
