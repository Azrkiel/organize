import { describe, expect, it } from "vitest";
import { getLocalDayRange } from "./local-day";

describe("getLocalDayRange", () => {
  it("finds midnight-to-midnight in the given time zone, not the server's own clock", () => {
    // 2026-09-22 02:00 UTC is still 2026-09-21 22:00 in New York (UTC-4 in September).
    const now = new Date("2026-09-22T02:00:00Z");
    const { startUtc, endUtc } = getLocalDayRange("America/New_York", now);

    expect(startUtc.toISOString()).toBe("2026-09-21T04:00:00.000Z"); // Sep 21 00:00 EDT
    expect(endUtc.toISOString()).toBe("2026-09-22T04:00:00.000Z"); // Sep 22 00:00 EDT
  });

  it("agrees with plain UTC when the time zone is UTC", () => {
    const now = new Date("2026-09-22T15:30:00Z");
    const { startUtc, endUtc } = getLocalDayRange("UTC", now);

    expect(startUtc.toISOString()).toBe("2026-09-22T00:00:00.000Z");
    expect(endUtc.toISOString()).toBe("2026-09-23T00:00:00.000Z");
  });
});
