import { describe, expect, it } from "vitest";
import { isDueTodayOrOverdue, isOverdue, isUpcoming } from "./task-buckets";

// Monday, Sep 21 2026, noon.
const NOW = new Date(2026, 8, 21, 12, 0, 0);

describe("isOverdue", () => {
  it("is true for a date before today, false for today or later", () => {
    expect(isOverdue("2026-09-20T23:59:00", NOW)).toBe(true);
    expect(isOverdue("2026-09-21T00:00:00", NOW)).toBe(false);
    expect(isOverdue("2026-09-21T23:00:00", NOW)).toBe(false);
    expect(isOverdue("2026-09-22T00:00:00", NOW)).toBe(false);
  });

  it("is false with no due date", () => {
    expect(isOverdue(null, NOW)).toBe(false);
  });
});

describe("isDueTodayOrOverdue", () => {
  it("includes anything due today or earlier, excludes tomorrow", () => {
    expect(isDueTodayOrOverdue("2026-09-19T09:00:00", NOW)).toBe(true);
    expect(isDueTodayOrOverdue("2026-09-21T23:59:00", NOW)).toBe(true);
    expect(isDueTodayOrOverdue("2026-09-22T00:00:00", NOW)).toBe(false);
  });
});

describe("isUpcoming", () => {
  it("includes tomorrow through 7 days out, excludes today and day 8", () => {
    expect(isUpcoming("2026-09-21T23:59:00", NOW)).toBe(false); // still today
    expect(isUpcoming("2026-09-22T00:00:00", NOW)).toBe(true); // tomorrow
    expect(isUpcoming("2026-09-28T23:59:00", NOW)).toBe(true); // day 7
    expect(isUpcoming("2026-09-29T00:00:00", NOW)).toBe(false); // day 8
  });

  it("is false with no due date", () => {
    expect(isUpcoming(null, NOW)).toBe(false);
  });
});
