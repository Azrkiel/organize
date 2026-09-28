import { describe, expect, it } from "vitest";
import { isTopicGap, keywords, suggestTopics } from "./topic-map";

const topics = [
  { id: "a", title: "Chemical Equilibrium", scheduledDate: "2026-10-06" },
  { id: "b", title: "Acids and Bases", scheduledDate: "2026-10-13" },
  { id: "c", title: "Thermodynamics", scheduledDate: null },
];

describe("keywords", () => {
  it("drops filler words and plural endings", () => {
    expect([...keywords("classes")]).toEqual(["class"]);
    expect([...keywords("Intro to Acids and Bases")]).toEqual(["acid", "base"]);
  });
});

describe("suggestTopics", () => {
  it("matches by keyword overlap", () => {
    const result = suggestTopics({ text: "Today we covered acids, bases, and pH.", date: null }, topics);
    expect(result.map((t) => t.id)).toEqual(["b"]);
  });

  it("matches by scheduled date even when wording differs", () => {
    const result = suggestTopics({ text: "Le Chatelier's principle and Q vs K", date: "2026-10-07" }, topics);
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });

  it("ranks keyword + date above keyword alone, and skips excluded topics", () => {
    const text = "Equilibrium constants. Thermodynamics preview.";
    expect(suggestTopics({ text, date: "2026-10-06" }, topics).map((t) => t.id)).toEqual(["a", "c"]);
    expect(suggestTopics({ text, date: "2026-10-06" }, topics, new Set(["a"])).map((t) => t.id)).toEqual(["c"]);
  });

  it("suggests nothing for unrelated text far from any date", () => {
    expect(suggestTopics({ text: "Organic nomenclature", date: "2026-12-01" }, topics)).toEqual([]);
  });
});

describe("isTopicGap", () => {
  it("is a gap only when due and without notes", () => {
    expect(isTopicGap({ scheduledDate: "2026-09-01", hasNotes: false }, "2026-09-28")).toBe(true);
    expect(isTopicGap({ scheduledDate: null, hasNotes: false }, "2026-09-28")).toBe(true);
    expect(isTopicGap({ scheduledDate: "2026-10-30", hasNotes: false }, "2026-09-28")).toBe(false);
    expect(isTopicGap({ scheduledDate: "2026-09-01", hasNotes: true }, "2026-09-28")).toBe(false);
  });
});
