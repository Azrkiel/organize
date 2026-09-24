import { describe, expect, it } from "vitest";
import { computeRms } from "./audio-decode";

describe("computeRms", () => {
  it("is 0 for silence", () => {
    expect(computeRms(new Float32Array(1000))).toBe(0);
  });

  it("is 0 for an empty buffer", () => {
    expect(computeRms(new Float32Array(0))).toBe(0);
  });

  it("is 1 for a full-scale square wave", () => {
    const samples = new Float32Array([1, -1, 1, -1, 1, -1]);
    expect(computeRms(samples)).toBeCloseTo(1, 10);
  });

  it("is proportional to amplitude", () => {
    const loud = new Float32Array([0.5, -0.5, 0.5, -0.5]);
    const quiet = new Float32Array([0.05, -0.05, 0.05, -0.05]);
    expect(computeRms(loud)).toBeCloseTo(10 * computeRms(quiet), 5);
  });
});
