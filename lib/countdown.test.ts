import { describe, expect, it } from "vitest";
import { daysUntil, formatCountdown } from "./countdown";

// Monday, Sep 21 2026, noon.
const NOW = new Date(2026, 8, 21, 12, 0, 0);

describe("daysUntil", () => {
  it("counts by calendar day, not elapsed hours", () => {
    expect(daysUntil(new Date(2026, 8, 21, 0, 0, 0), NOW)).toBe(0);
    expect(daysUntil(new Date(2026, 8, 22, 0, 0, 0), NOW)).toBe(1);
    expect(daysUntil(new Date(2026, 8, 30, 23, 59, 0), NOW)).toBe(9);
    expect(daysUntil(new Date(2026, 8, 20, 23, 59, 0), NOW)).toBe(-1);
  });
});

describe("formatCountdown", () => {
  it("labels near days, falls back to counted days further out", () => {
    expect(formatCountdown(0)).toBe("today");
    expect(formatCountdown(1)).toBe("tomorrow");
    expect(formatCountdown(9)).toBe("in 9 days");
    expect(formatCountdown(-1)).toBe("yesterday");
    expect(formatCountdown(-3)).toBe("3 days ago");
  });
});
