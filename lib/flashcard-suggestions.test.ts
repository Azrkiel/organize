import { describe, expect, it } from "vitest";
import { parseLectureNotes } from "./flashcard-suggestions";

describe("parseLectureNotes", () => {
  it("splits a well-formed trailing flashcard fence", () => {
    const markdown = [
      "## Summary",
      "",
      "Some notes about $E=mc^2$.",
      "",
      "```json-flashcards",
      '[{"front": "What is E?", "back": "Energy"}, {"front": "What is m?", "back": "Mass"}]',
      "```",
    ].join("\n");

    const result = parseLectureNotes(markdown);
    expect(result.body).toBe("## Summary\n\nSome notes about $E=mc^2$.");
    expect(result.suggestions).toEqual([
      { front: "What is E?", back: "Energy" },
      { front: "What is m?", back: "Mass" },
    ]);
  });

  it("keeps the full body and returns no suggestions when there's no fence", () => {
    const markdown = "## Summary\n\nJust notes, no flashcards.";
    const result = parseLectureNotes(markdown);
    expect(result.body).toBe(markdown);
    expect(result.suggestions).toEqual([]);
  });

  it("still strips the fence but returns no suggestions for invalid JSON", () => {
    const markdown = ["## Summary", "", "Notes here.", "", "```json-flashcards", "not valid json at all", "```"].join(
      "\n"
    );
    const result = parseLectureNotes(markdown);
    expect(result.body).toBe("## Summary\n\nNotes here.");
    expect(result.suggestions).toEqual([]);
  });

  it("still strips the fence but returns no suggestions when items fail validation", () => {
    const markdown = [
      "Notes.",
      "",
      "```json-flashcards",
      '[{"front": "", "back": "Energy"}]', // empty front fails the schema
      "```",
    ].join("\n");
    const result = parseLectureNotes(markdown);
    expect(result.body).toBe("Notes.");
    expect(result.suggestions).toEqual([]);
  });

  it("never throws on garbage input", () => {
    expect(() => parseLectureNotes("")).not.toThrow();
    expect(() => parseLectureNotes("```json-flashcards\n```")).not.toThrow();
  });
});
