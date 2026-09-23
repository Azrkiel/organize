"use client";

import { useEffect } from "react";

/**
 * Renders nothing. Registers `public/sw.js` in production only — a cached service worker
 * during local dev would fight Turbopack's own asset serving and HMR.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
