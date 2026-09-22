import { describe, expect, it } from "vitest";
import { parseTaskInput } from "./parse-task";

// Monday, Sep 21 2026, 12:00 — fixed so relative dates ("tomorrow", "friday") are deterministic.
const REF = new Date(2026, 8, 21, 12, 0, 0);

describe("parseTaskInput", () => {
  it("parses title, date, priority, and course together", () => {
    const result = parseTaskInput("calc hw tomorrow 5pm !high #calc", REF);
    expect(result.title).toBe("calc hw");
    expect(result.priority).toBe(3);
    expect(result.courseTag).toBe("calc");
    expect(result.dueAt).toEqual(new Date(2026, 8, 22, 17, 0, 0));
  });

  it("is order-independent — tags can appear anywhere", () => {
    const result = parseTaskInput("#calc essay due friday 3pm !high", REF);
    expect(result.title).toBe("essay due");
    expect(result.priority).toBe(3);
    expect(result.courseTag).toBe("calc");
    expect(result.dueAt).not.toBeNull();
  });

  it("defaults to no date, no priority, no course when none are given", () => {
    const result = parseTaskInput("buy groceries", REF);
    expect(result.title).toBe("buy groceries");
    expect(result.dueAt).toBeNull();
    expect(result.priority).toBe(0);
    expect(result.courseTag).toBeNull();
  });

  it.each([
    ["!high", 3],
    ["!hi", 3],
    ["!med", 2],
    ["!medium", 2],
    ["!low", 1],
  ] as const)("maps %s to priority %d", (tag, expected) => {
    expect(parseTaskInput(`task ${tag}`, REF).priority).toBe(expected);
  });

  it("handles a course tag with no priority or date", () => {
    const result = parseTaskInput("read chapter 3 #bio", REF);
    expect(result.courseTag).toBe("bio");
    expect(result.title).toBe("read chapter 3");
    expect(result.dueAt).toBeNull();
  });

  it("leaves an empty title when the input is only tags/a date", () => {
    const result = parseTaskInput("friday 3pm", REF);
    expect(result.title).toBe("");
    expect(result.dueAt).not.toBeNull();
  });
});
