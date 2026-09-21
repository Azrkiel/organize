"use client";

import { useEffect } from "react";
import { syncTimezone } from "@/app/actions";

const FLAG = "organize:tz-synced";

/** Renders nothing. Once per browser, saves the local time zone to settings. */
export function TimezoneSync() {
  useEffect(() => {
    try {
      if (localStorage.getItem(FLAG)) return;
    } catch {
      return;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    syncTimezone(tz)
      .then((done) => {
        if (done) {
          try {
            localStorage.setItem(FLAG, "1");
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
