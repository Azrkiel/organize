"use client";

import { useEffect, useState } from "react";

/** "Scan with iPhone to add slides" (PLAN.md Phase 12 task 1) — shown while a lecture is
 * recording. Encodes `/capture/{lectureId}`; that page requires sign-in like the rest of the app,
 * so scanning from a phone that isn't signed in just goes through /login first. */
export function QrPairingCard({ lectureId }: { lectureId: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `${window.location.origin}/capture/${lectureId}`;
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(url, { margin: 1, width: 200 }))
      .then((generated) => {
        if (!cancelled) setDataUrl(generated);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lectureId]);

  if (!dataUrl) return null;

  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-2 rounded-lg border p-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- a locally-generated data: URL, not a remote image */}
      <img src={dataUrl} alt="QR code linking to the slide-capture page for this lecture" width={160} height={160} />
      <p className="text-sm font-medium">Scan with iPhone to add slides</p>
      <p className="text-xs text-muted-foreground">Opens the capture page for this lecture on your phone.</p>
    </div>
  );
}
