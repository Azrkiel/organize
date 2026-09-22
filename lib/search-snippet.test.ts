import { describe, expect, it } from "vitest";
import { sanitizeHeadline } from "./search-snippet";

describe("sanitizeHeadline", () => {
  it("keeps ts_headline's own <b> highlight markers", () => {
    expect(sanitizeHeadline("the <b>calc</b> midterm")).toBe("the <b>calc</b> midterm");
  });

  it("escapes any other markup the note text itself contains", () => {
    expect(sanitizeHeadline('<script>alert(1)</script> <b>notes</b>')).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt; <b>notes</b>"
    );
  });

  it("escapes bare ampersands and angle brackets", () => {
    expect(sanitizeHeadline("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
  });
});
