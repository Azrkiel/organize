import { describe, expect, it } from "vitest";
import { tiptapToMarkdown } from "./tiptap-to-markdown";

function doc(...content: unknown[]) {
  return { type: "doc", content };
}
function paragraph(...content: unknown[]) {
  return { type: "paragraph", content };
}
function text(value: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) {
  return marks ? { type: "text", text: value, marks } : { type: "text", text: value };
}

describe("tiptapToMarkdown", () => {
  it("handles missing/malformed content without throwing", () => {
    expect(tiptapToMarkdown(null)).toBe("");
    expect(tiptapToMarkdown(undefined)).toBe("");
    expect(tiptapToMarkdown({})).toBe("");
    expect(tiptapToMarkdown("not a doc")).toBe("");
  });

  it("renders a plain paragraph", () => {
    expect(tiptapToMarkdown(doc(paragraph(text("Hello world."))))).toBe("Hello world.");
  });

  it("renders headings at their level", () => {
    expect(
      tiptapToMarkdown(doc({ type: "heading", attrs: { level: 2 }, content: [text("Chapter 1")] }))
    ).toBe("## Chapter 1");
  });

  it("renders bold, italic, strike, code, and a link", () => {
    expect(tiptapToMarkdown(doc(paragraph(text("bold", [{ type: "bold" }]))))).toBe("**bold**");
    expect(tiptapToMarkdown(doc(paragraph(text("it", [{ type: "italic" }]))))).toBe("*it*");
    expect(tiptapToMarkdown(doc(paragraph(text("gone", [{ type: "strike" }]))))).toBe("~~gone~~");
    expect(tiptapToMarkdown(doc(paragraph(text("code", [{ type: "code" }]))))).toBe("`code`");
    expect(
      tiptapToMarkdown(
        doc(paragraph(text("site", [{ type: "link", attrs: { href: "https://example.com" } }])))
      )
    ).toBe("[site](https://example.com)");
  });

  it("renders a bullet list", () => {
    const md = tiptapToMarkdown(
      doc({
        type: "bulletList",
        content: [
          { type: "listItem", content: [paragraph(text("one"))] },
          { type: "listItem", content: [paragraph(text("two"))] },
        ],
      })
    );
    expect(md).toBe("- one\n- two");
  });

  it("renders an ordered list with sequential numbers", () => {
    const md = tiptapToMarkdown(
      doc({
        type: "orderedList",
        content: [
          { type: "listItem", content: [paragraph(text("first"))] },
          { type: "listItem", content: [paragraph(text("second"))] },
        ],
      })
    );
    expect(md).toBe("1. first\n2. second");
  });

  it("renders a task list with checked/unchecked boxes", () => {
    const md = tiptapToMarkdown(
      doc({
        type: "taskList",
        content: [
          { type: "taskItem", attrs: { checked: true }, content: [paragraph(text("done"))] },
          { type: "taskItem", attrs: { checked: false }, content: [paragraph(text("not done"))] },
        ],
      })
    );
    expect(md).toBe("- [x] done\n- [ ] not done");
  });

  it("renders a blockquote with '> ' on every line", () => {
    const md = tiptapToMarkdown(doc({ type: "blockquote", content: [paragraph(text("quoted"))] }));
    expect(md).toBe("> quoted");
  });

  it("renders a fenced code block with its language", () => {
    const md = tiptapToMarkdown(
      doc({ type: "codeBlock", attrs: { language: "js" }, content: [{ type: "text", text: "const x = 1;" }] })
    );
    expect(md).toBe("```js\nconst x = 1;\n```");
  });

  it("renders a horizontal rule", () => {
    expect(tiptapToMarkdown(doc({ type: "horizontalRule" }))).toBe("---");
  });

  it("renders an image with alt text", () => {
    expect(tiptapToMarkdown(doc({ type: "image", attrs: { src: "a.png", alt: "A diagram" } }))).toBe(
      "![A diagram](a.png)"
    );
  });

  it("renders inline and block math as $...$ / $$...$$", () => {
    expect(tiptapToMarkdown(doc(paragraph(text("area is "), { type: "inlineMath", attrs: { latex: "r^2" } })))).toBe(
      "area is $r^2$"
    );
    expect(tiptapToMarkdown(doc({ type: "blockMath", attrs: { latex: "E = mc^2" } }))).toBe("$$\nE = mc^2\n$$");
  });

  it("renders a table as GFM markdown", () => {
    const cell = (t: string) => ({ type: "tableCell", content: [paragraph(text(t))] });
    const md = tiptapToMarkdown(
      doc({
        type: "table",
        content: [
          { type: "tableRow", content: [cell("A"), cell("B")] },
          { type: "tableRow", content: [cell("1"), cell("2")] },
        ],
      })
    );
    expect(md).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |");
  });

  it("joins multiple top-level blocks with a blank line", () => {
    const md = tiptapToMarkdown(doc(paragraph(text("first")), paragraph(text("second"))));
    expect(md).toBe("first\n\nsecond");
  });
});
