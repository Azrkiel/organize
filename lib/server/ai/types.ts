/** Provider interface for turning a transcript into lecture notes (PLAN.md Phase 10 task 1),
 * kept separate from the Gemini implementation so a different provider can be swapped in later
 * without touching any of the calling code. */
export interface LectureNotesProvider {
  /** Returns raw Markdown: the notes body plus the trailing ```json-flashcards fence — see
   * lib/server/ai/prompts.ts and lib/flashcard-suggestions.ts for that shape. Throws on failure;
   * callers distinguish a rate limit via `isRateLimitError`. */
  generateLectureNotes(input: { transcript: string; courseName: string | null }): Promise<string>;
}

export class RateLimitError extends Error {
  constructor(message = "Free limit reached, try again in a minute.") {
    super(message);
    this.name = "RateLimitError";
  }
}
