import { describe, expect, it } from "vitest";
import { formatDuration } from "./format-duration";

describe("formatDuration", () => {
  it("formats under a minute", () => expect(formatDuration(7)).toBe("0:07"));
  it("formats minutes and seconds", () => expect(formatDuration(754)).toBe("12:34"));
  it("formats an hour or more as h:mm:ss", () => expect(formatDuration(3932)).toBe("1:05:32"));
  it("clamps negative input to zero", () => expect(formatDuration(-5)).toBe("0:00"));
});
