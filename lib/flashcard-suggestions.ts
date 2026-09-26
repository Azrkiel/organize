import { z } from "zod";

export const flashcardSuggestionSchema = z.object({
  front: z.string().trim().min(1).max(2000),
  back: z.string().trim().min(1).max(2000),
});
export type FlashcardSuggestion = z.infer<typeof flashcardSuggestionSchema>;

const suggestionsArraySchema = z.array(flashcardSuggestionSchema).max(20);

// Matches a fenced ```json-flashcards ... ``` block, wherever it appears (normally at the very
// end of the generated notes, per the prompt's instructions in lib/server/ai/prompts.ts). A
// distinctive fence tag rather than plain ```json avoids colliding with an ordinary JSON example
// the notes body might otherwise contain.
const FLASHCARD_FENCE = /\n?```json-flashcards\s*\n([\s\S]*?)\n```\s*$/;

export type ParsedLectureNotes = {
  /** The notes body with the flashcard fence (if any) removed, regardless of whether its JSON parsed. */
  body: string;
  /** Empty when there was no fence, or its contents didn't parse/validate — never throws either way. */
  suggestions: FlashcardSuggestion[];
};

/** Splits a trailing flashcard-suggestions block off the end of generated (or pasted) lecture
 * notes. Malformed or missing JSON just means no suggestions, never a failure (PLAN.md Phase 10
 * task 4) — the notes themselves are always kept. */
export function parseLectureNotes(markdown: string): ParsedLectureNotes {
  const match = markdown.match(FLASHCARD_FENCE);
  if (!match) return { body: markdown.trim(), suggestions: [] };

  const body = markdown.slice(0, match.index).trim();

  try {
    const raw = JSON.parse(match[1]);
    const result = suggestionsArraySchema.safeParse(raw);
    return { body, suggestions: result.success ? result.data : [] };
  } catch {
    return { body, suggestions: [] };
  }
}
