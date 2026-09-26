import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { markdownToTiptapJson } from "./markdown-to-tiptap";

/** Depth-first search for every node of a given type anywhere in the doc. */
function findNodes(node: JSONContent, type: string): JSONContent[] {
  const found: JSONContent[] = [];
  if (node.type === type) found.push(node);
  for (const child of node.content ?? []) found.push(...findNodes(child, type));
  return found;
}

describe("markdownToTiptapJson", () => {
  it("parses a heading and a bold word into the expected node/mark types", () => {
    const doc = markdownToTiptapJson("## Summary\n\nThis is **important**.");
    expect(doc.type).toBe("doc");

    const headings = findNodes(doc, "heading");
    expect(headings).toHaveLength(1);
    expect(headings[0].attrs?.level).toBe(2);

    const textNodes = findNodes(doc, "text");
    const bold = textNodes.find((n) => n.text === "important");
    expect(bold?.marks?.some((m) => m.type === "bold")).toBe(true);
  });

  it("parses inline math ($...$) into an inlineMath node with the raw LaTeX", () => {
    const doc = markdownToTiptapJson("The formula $E=mc^2$ is famous.");
    const mathNodes = findNodes(doc, "inlineMath");
    expect(mathNodes).toHaveLength(1);
    expect(mathNodes[0].attrs?.latex).toBe("E=mc^2");
  });

  it("parses block math ($$...$$) into a blockMath node", () => {
    const doc = markdownToTiptapJson("$$\\sum_{i=1}^n x_i$$");
    const mathNodes = findNodes(doc, "blockMath");
    expect(mathNodes).toHaveLength(1);
    expect(mathNodes[0].attrs?.latex).toBe("\\sum_{i=1}^n x_i");
  });

  it("preserves mhchem syntax inside inline math", () => {
    const doc = markdownToTiptapJson("Sulfuric acid is $\\ce{H2SO4}$.");
    const mathNodes = findNodes(doc, "inlineMath");
    expect(mathNodes).toHaveLength(1);
    expect(mathNodes[0].attrs?.latex).toBe("\\ce{H2SO4}");
  });

  it("parses a task list into taskList/taskItem nodes", () => {
    const doc = markdownToTiptapJson("- [ ] Review chapter 3\n- [x] Read chapter 2");
    expect(findNodes(doc, "taskList")).toHaveLength(1);
    expect(findNodes(doc, "taskItem")).toHaveLength(2);
  });

  it("never throws on malformed math delimiters", () => {
    expect(() => markdownToTiptapJson("This has an unclosed $ dollar sign.")).not.toThrow();
  });
});
