import { describe, expect, it } from "vitest";
import { formatBytes } from "./format-bytes";

describe("formatBytes", () => {
  it("formats bytes below 1 KB as-is", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats KB/MB/GB with fewer decimals as the number grows", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(15 * 1024)).toBe("15 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
  });
});
