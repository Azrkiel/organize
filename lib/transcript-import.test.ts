import { describe, expect, it } from "vitest";
import { getTranscriptExtension, parseTranscriptFile } from "./transcript-import";

describe("getTranscriptExtension", () => {
  it("recognizes txt/srt/vtt case-insensitively", () => {
    expect(getTranscriptExtension("lecture.TXT")).toBe("txt");
    expect(getTranscriptExtension("lecture.srt")).toBe("srt");
    expect(getTranscriptExtension("lecture.VTT")).toBe("vtt");
  });

  it("rejects anything else", () => {
    expect(getTranscriptExtension("lecture.docx")).toBeNull();
    expect(getTranscriptExtension("lecture")).toBeNull();
  });
});

describe("parseTranscriptFile", () => {
  it("passes .txt through as-is, just trimmed", () => {
    expect(parseTranscriptFile("notes.txt", "  Hello there.\n\nBye.  ")).toBe("Hello there.\n\nBye.");
  });

  it("strips SRT cue numbers and timecodes", () => {
    const srt = [
      "1",
      "00:00:00,000 --> 00:00:02,500",
      "Hello world.",
      "",
      "2",
      "00:00:02,500 --> 00:00:05,000",
      "This is a test.",
      "",
    ].join("\n");
    expect(parseTranscriptFile("lecture.srt", srt)).toBe("Hello world.\nThis is a test.");
  });

  it("strips the WEBVTT header, NOTE blocks, and inline tags from VTT", () => {
    const vtt = [
      "WEBVTT",
      "",
      "NOTE this is a comment",
      "",
      "00:00:00.000 --> 00:00:02.500 align:start",
      "<v Professor>Welcome to <b>chemistry</b>.",
      "",
      "00:00:02.500 --> 00:00:05.000",
      "Let's begin.",
      "",
    ].join("\n");
    expect(parseTranscriptFile("lecture.vtt", vtt)).toBe("Welcome to chemistry.\nLet's begin.");
  });

  it("joins multi-line cue text with a space, not a newline", () => {
    const srt = ["1", "00:00:00,000 --> 00:00:02,000", "Line one", "line two", ""].join("\n");
    expect(parseTranscriptFile("lecture.srt", srt)).toBe("Line one line two");
  });

  it("returns null for an unsupported extension", () => {
    expect(parseTranscriptFile("lecture.docx", "whatever")).toBeNull();
  });

  it("returns null when nothing usable comes out", () => {
    expect(parseTranscriptFile("lecture.srt", "1\n00:00:00,000 --> 00:00:01,000\n\n")).toBeNull();
  });
});
