import { describe, expect, it } from "vitest";
import { insertSlideImages } from "@/lib/insert-slide-images";

describe("insertSlideImages", () => {
  it("replaces a known placeholder with a Markdown image pointing at the photo route", () => {
    const result = insertSlideImages("Some text.\n\n[SLIDE_IMAGE 1]\n\nMore text.", { 1: "photo-abc" });
    expect(result).toBe("Some text.\n\n![Slide 1](/api/lecture-photos/photo-abc)\n\nMore text.");
  });

  it("replaces multiple placeholders for different slides", () => {
    const result = insertSlideImages("[SLIDE_IMAGE 1]\n\n[SLIDE_IMAGE 2]", { 1: "a", 2: "b" });
    expect(result).toBe("![Slide 1](/api/lecture-photos/a)\n\n![Slide 2](/api/lecture-photos/b)");
  });

  it("drops a placeholder whose number has no matching photo", () => {
    const result = insertSlideImages("Before.\n\n[SLIDE_IMAGE 9]\n\nAfter.", { 1: "a" });
    expect(result).toBe("Before.\n\n\n\nAfter.");
  });

  it("leaves markdown with no placeholders untouched", () => {
    const result = insertSlideImages("# Heading\n\nJust text, no slides.", { 1: "a" });
    expect(result).toBe("# Heading\n\nJust text, no slides.");
  });
});
