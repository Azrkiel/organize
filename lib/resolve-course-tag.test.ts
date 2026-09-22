import { describe, expect, it } from "vitest";
import { resolveCourseTag } from "./resolve-course-tag";
import type { Course } from "./types";

function course(name: string): Course {
  return {
    id: name,
    user_id: "user",
    name,
    color: "#000",
    archived: false,
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const courses = [course("Calculus II"), course("Cell Biology"), course("Organic Chemistry")];

describe("resolveCourseTag", () => {
  it("prefers an exact match", () => {
    expect(resolveCourseTag("Cell Biology", courses)?.name).toBe("Cell Biology");
  });

  it("falls back to a name that starts with the tag", () => {
    expect(resolveCourseTag("calc", courses)?.name).toBe("Calculus II");
  });

  it("falls back to a name that contains the tag", () => {
    expect(resolveCourseTag("chem", courses)?.name).toBe("Organic Chemistry");
  });

  it("is case-insensitive", () => {
    expect(resolveCourseTag("BIOLOGY", courses)?.name).toBe("Cell Biology");
  });

  it("returns null when nothing matches", () => {
    expect(resolveCourseTag("physics", courses)).toBeNull();
  });
});
