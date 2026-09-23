import { describe, expect, it } from "vitest";
import { formatClock, remainingSeconds } from "./focus-timer";

describe("remainingSeconds", () => {
  it("counts down to the stored end timestamp regardless of when it's called", () => {
    const now = 1_700_000_000_000;
    expect(remainingSeconds(now + 65_000, now)).toBe(65);
    expect(remainingSeconds(now + 500, now)).toBe(1); // rounds, not truncates
  });

  it("clamps at 0 once the end time has passed, never goes negative", () => {
    const now = 1_700_000_000_000;
    expect(remainingSeconds(now - 1000, now)).toBe(0);
    expect(remainingSeconds(now, now)).toBe(0);
  });
});

describe("formatClock", () => {
  it("formats as m:ss with a zero-padded seconds field", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(1500)).toBe("25:00");
  });
});
