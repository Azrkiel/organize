import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { buildLectureNotesPrompt } from "@/lib/server/ai/prompts";
import { RateLimitError, type LectureNotesProvider } from "@/lib/server/ai/types";

// "gemini-flash-latest" is Google's own alias for whatever their current Flash model is (checked
// against ai.google.dev's docs — PLAN.md/CLAUDE.md rule 7), so the default keeps working as
// Google ships new models instead of quietly pointing at a version that gets deprecated. A
// specific version can still be pinned via GEMINI_MODEL if that's ever wanted.
const DEFAULT_MODEL = "gemini-flash-latest";

// A very long transcript (PLAN.md's own ~30k-word threshold) risks a single call running long or
// hitting an output-length ceiling. Splitting it into per-chunk summaries and merging them is the
// plan's stated approach; the actual notes-quality tradeoffs of chunking are easiest to tune
// against a real transcript, once the 🧑 checkpoint (a real GEMINI_API_KEY) is in place — tracked
// as a known gap rather than guessed at blind. Ordinary lecture transcripts (under ~2 hours) sit
// nowhere near this, so it isn't blocking the common case.
const LONG_TRANSCRIPT_WORD_THRESHOLD = 30_000;

export class GeminiLectureNotesProvider implements LectureNotesProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generateLectureNotes({ transcript, courseName }: { transcript: string; courseName: string | null }): Promise<string> {
    if (transcript.trim().split(/\s+/).length > LONG_TRANSCRIPT_WORD_THRESHOLD) {
      throw new Error(
        "This transcript is unusually long (over ~30k words). Splitting long transcripts isn't built yet — try importing a shorter transcript, or ask the owner to add chunking support."
      );
    }

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: buildLectureNotesPrompt(transcript, courseName),
      });
      const text = response.text;
      if (!text) throw new Error("Gemini returned an empty response.");
      return text;
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) throw new RateLimitError();
      throw err;
    }
  }
}

let cached: GeminiLectureNotesProvider | null = null;

/** Returns the Gemini provider if GEMINI_API_KEY is set, else null — callers use null as the
 * signal to fall back to the copy-prompt/paste-notes flow (PLAN.md Phase 10 task 6). */
export function getGeminiProvider(): GeminiLectureNotesProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cached) cached = new GeminiLectureNotesProvider(apiKey, process.env.GEMINI_MODEL || DEFAULT_MODEL);
  return cached;
}
