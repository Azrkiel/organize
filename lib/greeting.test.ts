import { describe, expect, it } from "vitest";
import { getGreeting } from "./greeting";

describe("getGreeting", () => {
  it("buckets the day into night/morning/afternoon/evening", () => {
    expect(getGreeting(2)).toBe("Good night");
    expect(getGreeting(9)).toBe("Good morning");
    expect(getGreeting(15)).toBe("Good afternoon");
    expect(getGreeting(20)).toBe("Good evening");
  });

  it("wraps out-of-range hours instead of throwing", () => {
    expect(getGreeting(24)).toBe(getGreeting(0));
    expect(getGreeting(-1)).toBe(getGreeting(23));
  });
});
