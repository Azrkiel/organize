import { describe, expect, it } from "vitest";
import { generateLectureTitle } from "./lecture-title";

describe("generateLectureTitle", () => {
  it("includes the course name and short date", () => {
    expect(generateLectureTitle("Chem", new Date(2026, 8, 21))).toBe("Chem Lecture, Sep 21");
  });

  it("falls back to a bare date with no course", () => {
    expect(generateLectureTitle(null, new Date(2026, 8, 21))).toBe("Lecture, Sep 21");
  });

  it("falls back to a bare date with an empty course name", () => {
    expect(generateLectureTitle("", new Date(2026, 0, 3))).toBe("Lecture, Jan 3");
  });
});
