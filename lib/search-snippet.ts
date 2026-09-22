/**
 * `search_all`'s snippet comes from Postgres `ts_headline` run over a note's raw plain text
 * (`0001_init.sql`), which wraps matches in `<b>...</b>` but does not escape the rest of the
 * text. The command palette renders it with `dangerouslySetInnerHTML`, so anything the note
 * itself contains — e.g. text pasted verbatim from somewhere that included a `<script>` tag —
 * must be escaped before it reaches the DOM, while still letting `ts_headline`'s own `<b>`
 * highlight markers through.
 */
export function sanitizeHeadline(snippet: string): string {
  const escaped = snippet.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>");
}
