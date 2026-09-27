import { describe, expect, it } from "vitest";
import { computeResizedDimensions } from "./compress-image";

describe("computeResizedDimensions", () => {
  it("leaves an already-small image untouched", () => {
    expect(computeResizedDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("caps the long edge of a landscape photo at maxDimension", () => {
    expect(computeResizedDimensions(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("caps the long edge of a portrait photo at maxDimension", () => {
    expect(computeResizedDimensions(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("treats a square image right at the limit as already fine", () => {
    expect(computeResizedDimensions(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("scales a square image over the limit down to exactly maxDimension on both sides", () => {
    expect(computeResizedDimensions(2000, 2000, 1600)).toEqual({ width: 1600, height: 1600 });
  });
});
