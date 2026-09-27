"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getLecturePhotosAction } from "@/app/(app)/actions/lecture-photos";

type LivePhoto = { id: string; url: string; caption: string | null };

/** Slides taken on the phone appear here within seconds via Supabase Realtime (PLAN.md Phase 12
 * task 4) — RLS on `lecture_photos` (user_id = auth.uid()) already scopes which INSERTs this
 * client receives, same as every other table in this app. */
export function LiveSlidePhotos({ lectureId }: { lectureId: string }) {
  const [photos, setPhotos] = useState<LivePhoto[]>([]);

  useEffect(() => {
    let cancelled = false;
    setPhotos([]);

    getLecturePhotosAction(lectureId).then((initial) => {
      if (cancelled) return;
      setPhotos(initial.filter((p) => p.signedUrl).map((p) => ({ id: p.id, url: p.signedUrl!, caption: p.caption })));
    });

    const supabase = createClient();
    const channel = supabase
      .channel(`lecture-photos-${lectureId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lecture_photos", filter: `lecture_id=eq.${lectureId}` },
        async (payload) => {
          const row = payload.new as { id: string; storage_path: string; caption: string | null };
          const { data: signed } = await supabase.storage.from("lecture-photos").createSignedUrl(row.storage_path, 3600);
          if (!signed || cancelled) return;
          setPhotos((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, { id: row.id, url: signed.signedUrl, caption: row.caption }]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [lectureId]);

  if (photos.length === 0) return null;

  return (
    <div className="mx-auto flex max-w-xs flex-col gap-2">
      <p className="text-center text-xs font-medium text-muted-foreground">
        {photos.length} slide{photos.length === 1 ? "" : "s"} from your phone
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element -- a signed Storage URL, not next/image-optimizable
          <img key={p.id} src={p.url} alt={p.caption ?? "Slide photo"} className="h-16 w-16 shrink-0 rounded-md object-cover" />
        ))}
      </div>
    </div>
  );
}
