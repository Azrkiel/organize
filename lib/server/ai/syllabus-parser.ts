import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { buildSyllabusPrompt } from "@/lib/server/ai/prompts";
import { RateLimitError } from "@/lib/server/ai/types";

const DEFAULT_MODEL = "gemini-flash-latest";

/** Sends a syllabus to Gemini and returns its raw JSON text (PLAN.md Phase 13 task 2). Returns
 * null when no GEMINI_API_KEY is set — the caller's signal to offer the copy-prompt/paste-JSON
 * fallback. Throws `RateLimitError` on a 429 (no auto-retry loop, per the plan). */
export async function parseSyllabusWithGemini(rawText: string, courseName: string | null): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const client = new GoogleGenAI({ apiKey });
  try {
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents: buildSyllabusPrompt(rawText, courseName, new Date().getFullYear()),
      config: { responseMimeType: "application/json" },
    });
    const text = response.text;
    if (!text) throw new Error("Gemini returned an empty response.");
    return text;
  } catch (err) {
    if (err instanceof ApiError) {
      // Same handling as the notes provider: never show Google's raw JSON error body in the UI.
      console.error("Gemini API error (syllabus)", err.status, err.message);
      if (err.status === 429) throw new RateLimitError();
      if (err.status === 400 || err.status === 401 || err.status === 403) {
        throw new Error("Gemini rejected the request — GEMINI_API_KEY is likely missing, invalid, or revoked.");
      }
      throw new Error(`Gemini API error (${err.status}). Check the Vercel function logs for details.`);
    }
    throw err;
  }
}
