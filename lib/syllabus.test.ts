import { describe, expect, it } from "vitest";
import { allDayStartsAt, parseSyllabusJson, planSyllabusImport } from "./syllabus";

describe("parseSyllabusJson", () => {
  it("parses a fenced JSON reply with preamble", () => {
    const reply = 'Here you go:\n```json\n{"course_name":"Chem 101","schedule":[{"week":1,"date":"2026-09-01","topics":["Atoms"]}],"assessments":[]}\n```';
    const parsed = parseSyllabusJson(reply);
    expect(parsed?.course_name).toBe("Chem 101");
    expect(parsed?.schedule[0]).toEqual({ week: 1, date: "2026-09-01", topics: ["Atoms"], readings: [] });
  });

  it("degrades bad dates and unknown kinds instead of rejecting", () => {
    const parsed = parseSyllabusJson(
      JSON.stringify({ assessments: [{ title: "Midterm", kind: "test", date: "Oct 3rd", weight: "25" }] })
    );
    expect(parsed?.assessments[0]).toMatchObject({ title: "Midterm", kind: "assignment", date: null, weight: 25 });
  });

  it("returns null when there is no JSON object", () => {
    expect(parseSyllabusJson("Sorry, I can't read that.")).toBeNull();
    expect(parseSyllabusJson("{ not json }")).toBeNull();
  });
});

describe("planSyllabusImport", () => {
  it("creates one topic per schedule topic, in order, with readings as description", () => {
    const { topics } = planSyllabusImport({
      schedule: [
        { week: 1, date: "2026-09-01", topics: ["Atoms", "Moles"], readings: ["Ch. 1"] },
        { week: 2, date: null, topics: ["Bonding"], readings: [] },
      ],
      assessments: [],
      grading: [],
    });
    expect(topics).toEqual([
      { title: "Atoms", description: "Readings: Ch. 1", week: 1, scheduledDate: "2026-09-01", position: 0 },
      { title: "Moles", description: "Readings: Ch. 1", week: 1, scheduledDate: "2026-09-01", position: 1 },
      { title: "Bonding", description: null, week: 2, scheduledDate: null, position: 2 },
    ]);
  });

  it("dated exams/quizzes become events; everything else becomes a task", () => {
    const { assessments } = planSyllabusImport({
      schedule: [],
      assessments: [
        { title: "Midterm", kind: "exam", date: "2026-10-10" },
        { title: "Quiz 1", kind: "quiz", date: null },
        { title: "Lab report", kind: "assignment", date: "2026-09-20" },
        { title: "Final project", kind: "project", date: null },
      ],
      grading: [],
    });
    expect(assessments).toEqual([
      { type: "event", title: "Midterm", date: "2026-10-10" },
      { type: "task", title: "Quiz 1", date: null },
      { type: "task", title: "Lab report", date: "2026-09-20" },
      { type: "task", title: "Final project", date: null },
    ]);
  });
});

describe("allDayStartsAt", () => {
  it("anchors at noon UTC so the date survives US/EU time zones", () => {
    expect(allDayStartsAt("2026-10-10")).toBe("2026-10-10T12:00:00.000Z");
  });
});
