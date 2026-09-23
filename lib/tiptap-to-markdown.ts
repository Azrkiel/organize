/**
 * Converts a TipTap document (the JSON shape stored in `notes.content`) to Markdown. Reused by
 * the "Export all notes" ZIP (PLAN.md Phase 8 task 4) and, per the plan, Phase 11's NotebookLM
 * export. Framework-agnostic on purpose — no TipTap import, just the JSON shape it produces.
 *
 * Math nodes (from `@tiptap/extension-mathematics`) become `$latex$` / `$$\nlatex\n$$`, matching
 * the plan's exact spec. Anything malformed or unrecognized is skipped rather than thrown —
 * one broken note shouldn't fail an export of everything else.
 */

export type TiptapMark = { type: string; attrs?: Record<string, unknown> };
export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
};

function isNode(value: unknown): value is TiptapNode {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

function renderMarks(text: string, marks: TiptapMark[] | undefined): string {
  if (!marks || marks.length === 0) return text;
  let result = text;
  const has = (type: string) => marks.some((m) => m.type === type);
  if (has("code")) result = `\`${result}\``;
  if (has("bold")) result = `**${result}**`;
  if (has("italic")) result = `*${result}*`;
  if (has("strike")) result = `~~${result}~~`;
  const link = marks.find((m) => m.type === "link");
  if (link && typeof link.attrs?.href === "string") result = `[${result}](${link.attrs.href})`;
  return result;
}

/** Renders a node's inline (text-level) children — used inside paragraphs, headings, list items. */
function renderInline(nodes: TiptapNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "text") return renderMarks(node.text ?? "", node.marks);
      if (node.type === "hardBreak") return "  \n";
      if (node.type === "inlineMath") return `$${String(node.attrs?.latex ?? "")}$`;
      if (node.type === "image") {
        const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
        const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
        return `![${alt}](${src})`;
      }
      // Unknown inline node: render its own children rather than dropping the text entirely.
      return renderInline(node.content);
    })
    .join("");
}

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => (line ? prefix + line : line))
    .join("\n");
}

function renderList(node: TiptapNode, ordered: boolean, depth: number): string {
  const items = node.content ?? [];
  return items
    .map((item, i) => {
      const marker = ordered ? `${i + 1}. ` : "- ";
      const body = renderBlocks(item.content, depth + 1).trimStart();
      const lines = body.split("\n");
      const first = lines[0] ?? "";
      const rest = lines
        .slice(1)
        .map((l) => (l ? " ".repeat(marker.length) + l : l))
        .join("\n");
      return marker + first + (rest ? "\n" + rest : "");
    })
    .join("\n");
}

function renderTaskList(node: TiptapNode): string {
  const items = node.content ?? [];
  return items
    .map((item) => {
      const box = item.attrs?.checked ? "[x]" : "[ ]";
      return `- ${box} ${renderInline(flattenFirstParagraph(item.content))}`;
    })
    .join("\n");
}

/** A taskItem's own text lives inside a nested paragraph; unwrap just that first paragraph's inline content. */
function flattenFirstParagraph(nodes: TiptapNode[] | undefined): TiptapNode[] | undefined {
  const first = nodes?.[0];
  return first?.type === "paragraph" ? first.content : nodes;
}

function renderTable(node: TiptapNode): string {
  const rows = (node.content ?? []).filter((r) => r.type === "tableRow");
  if (rows.length === 0) return "";
  const cellText = (cell: TiptapNode) =>
    renderInline((cell.content ?? []).flatMap((p) => p.content ?? [])).replace(/\|/g, "\\|").trim();

  const rendered = rows.map((row) => (row.content ?? []).map(cellText));
  const colCount = Math.max(...rendered.map((r) => r.length));
  const header = rendered[0] ?? [];
  const lines = [
    `| ${Array.from({ length: colCount }, (_, i) => header[i] ?? "").join(" | ")} |`,
    `| ${Array.from({ length: colCount }, () => "---").join(" | ")} |`,
    ...rendered.slice(1).map((r) => `| ${Array.from({ length: colCount }, (_, i) => r[i] ?? "").join(" | ")} |`),
  ];
  return lines.join("\n");
}

function renderBlock(node: TiptapNode, depth: number): string {
  switch (node.type) {
    case "paragraph":
      return renderInline(node.content);
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
      return `${"#".repeat(Math.min(Math.max(level, 1), 6))} ${renderInline(node.content)}`;
    }
    case "bulletList":
      return renderList(node, false, depth);
    case "orderedList":
      return renderList(node, true, depth);
    case "taskList":
      return renderTaskList(node);
    case "blockquote":
      return indent(renderBlocks(node.content, depth), "> ");
    case "codeBlock": {
      const lang = typeof node.attrs?.language === "string" ? node.attrs.language : "";
      const code = (node.content ?? []).map((n) => n.text ?? "").join("\n");
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case "horizontalRule":
      return "---";
    case "image": {
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      return `![${alt}](${src})`;
    }
    case "blockMath":
      return `$$\n${String(node.attrs?.latex ?? "")}\n$$`;
    case "table":
      return renderTable(node);
    default:
      // Unknown block node: fall back to its inline content so the text isn't silently lost.
      return renderInline(node.content);
  }
}

function renderBlocks(nodes: TiptapNode[] | undefined, depth: number): string {
  if (!nodes) return "";
  return nodes
    .map((n) => renderBlock(n, depth))
    .filter((s) => s.length > 0)
    .join("\n\n");
}

/** Converts a TipTap document (as stored in `notes.content`) to a Markdown string. */
export function tiptapToMarkdown(content: unknown): string {
  if (!isNode(content)) return "";
  return renderBlocks(content.content, 0).trim();
}
