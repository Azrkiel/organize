import { describe, expect, it } from "vitest";
import { computeRms, rmsToMeterPercent } from "./audio-decode";

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

describe("rmsToMeterPercent", () => {
  it("is 0 for silence", () => {
    expect(rmsToMeterPercent(0)).toBe(0);
  });

  it("is 100 at full scale (0 dBFS)", () => {
    expect(rmsToMeterPercent(1)).toBeCloseTo(100, 5);
  });

  it("gives quiet speech a visibly non-trivial reading, unlike a linear scale", () => {
    // RMS 0.02 is typical for a normal speaking voice picked up by a laptop mic — a linear
    // scale (rms * 100) would show 2%, unreadable; the dB scale should show far more.
    const percent = rmsToMeterPercent(0.02);
    expect(percent).toBeGreaterThan(30);
    expect(percent).toBeLessThan(100);
  });

  it("is monotonically increasing with amplitude", () => {
    expect(rmsToMeterPercent(0.01)).toBeLessThan(rmsToMeterPercent(0.05));
    expect(rmsToMeterPercent(0.05)).toBeLessThan(rmsToMeterPercent(0.2));
    expect(rmsToMeterPercent(0.2)).toBeLessThan(rmsToMeterPercent(0.8));
  });

  it("never exceeds the 0-100 range", () => {
    expect(rmsToMeterPercent(-1)).toBe(0); // not a valid RMS, but should never go negative
    expect(rmsToMeterPercent(5)).toBeLessThanOrEqual(100);
  });
});
