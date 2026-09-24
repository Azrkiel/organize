import { describe, expect, it } from "vitest";
import { pickAudioMimeType } from "./lecture-recording-support";

describe("pickAudioMimeType", () => {
  it("prefers webm/opus when supported", () => {
    const supported = new Set(["audio/webm;codecs=opus", "audio/webm"]);
    expect(pickAudioMimeType((t) => supported.has(t))).toBe("audio/webm;codecs=opus");
  });

  it("falls back to mp4 for Safari", () => {
    const supported = new Set(["audio/mp4;codecs=mp4a.40.2", "audio/mp4"]);
    expect(pickAudioMimeType((t) => supported.has(t))).toBe("audio/mp4;codecs=mp4a.40.2");
  });

  it("returns an empty string when nothing matches", () => {
    expect(pickAudioMimeType(() => false)).toBe("");
  });

  it("treats a throwing isTypeSupported as unsupported rather than failing", () => {
    expect(
      pickAudioMimeType(() => {
        throw new Error("boom");
      })
    ).toBe("");
  });
});
