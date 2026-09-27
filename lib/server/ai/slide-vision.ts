import "server-only";
import { ApiError, GoogleGenAI, createPartFromBase64, createUserContent } from "@google/genai";
import { buildSlideTextPrompt } from "@/lib/server/ai/prompts";

const DEFAULT_MODEL = "gemini-flash-latest";

let cached: { client: GoogleGenAI; model: string } | null = null;

function getClient(): { client: GoogleGenAI; model: string } | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cached) cached = { client: new GoogleGenAI({ apiKey }), model: process.env.GEMINI_MODEL || DEFAULT_MODEL };
  return cached;
}

/** Extracts slide text/equations/diagram descriptions with Gemini vision (PLAN.md Phase 12 task
 * 5). Returns null (rather than throwing) whenever Gemini can't produce a result for any reason —
 * missing key, rate limit, or any other API error — which the caller reads as "fall back to
 * tesseract.js for this photo" instead of failing the upload. */
export async function extractSlideTextWithGemini(imageBytes: Buffer, mimeType: string): Promise<string | null> {
  const provider = getClient();
  if (!provider) return null;

  try {
    const response = await provider.client.models.generateContent({
      model: provider.model,
      contents: createUserContent([buildSlideTextPrompt(), createPartFromBase64(imageBytes.toString("base64"), mimeType)]),
    });
    return response.text?.trim() || null;
  } catch (err) {
    if (err instanceof ApiError) {
      console.error("Gemini vision error", err.status, err.message);
      return null;
    }
    throw err;
  }
}
