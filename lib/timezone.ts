/** True when `tz` is an IANA time zone name this runtime understands (e.g. "America/Chicago"). */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The value `settings.timezone` starts with; treated as "not chosen yet". */
export const DEFAULT_TIMEZONE = "America/New_York";
