import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "./sanitize-filename";

describe("sanitizeFilename", () => {
  it("strips characters invalid in file/folder names", () => {
    expect(sanitizeFilename('Calc: HW #3 <final>?')).toBe("Calc HW #3 final");
    expect(sanitizeFilename("a/b\\c*d")).toBe("abcd");
  });

  it("collapses runs of whitespace and trims", () => {
    expect(sanitizeFilename("  Chem   101  ")).toBe("Chem 101");
  });

  it("falls back when the cleaned result is empty", () => {
    expect(sanitizeFilename("???")).toBe("Untitled");
    expect(sanitizeFilename("   ")).toBe("Untitled");
    expect(sanitizeFilename("", "No course")).toBe("No course");
  });

  it("caps length so a very long title can't break a path", () => {
    expect(sanitizeFilename("x".repeat(300)).length).toBe(150);
  });
});
