/** Replaces `[SLIDE_IMAGE n]` placeholder lines (which the notes prompt asks the model to emit
 * right after introducing a slide's content — see lib/server/ai/prompts.ts) with a real Markdown
 * image pointing at that slide's photo (PLAN.md Phase 12 task 7). Deterministic and separate from
 * the model's own output on purpose: the model only ever has to reproduce a plain integer, never a
 * URL or a real photo id, so there's nothing for it to hallucinate. A placeholder whose number
 * doesn't match a known slide (a model slip, or a slide added/removed between prompt and paste for
 * the "Paste notes" fallback) is silently dropped rather than left visible in the note. */
export function insertSlideImages(markdown: string, photoIdByIndex: Record<number, string>): string {
  return markdown.replace(/^\[SLIDE_IMAGE (\d+)\]$/gm, (match, indexStr: string) => {
    const photoId = photoIdByIndex[Number(indexStr)];
    return photoId ? `![Slide ${indexStr}](/api/lecture-photos/${photoId})` : "";
  });
}
