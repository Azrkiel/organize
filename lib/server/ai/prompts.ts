/** The lecture-notes prompt (PLAN.md Phase 10 task 2, extended by Phase 12 task 7 for slides).
 * Shared by the real Gemini call and the no-key "Copy prompt for Claude" fallback, so both paths
 * produce notes in the same shape. */
export function buildLectureNotesPrompt(transcript: string, courseName: string | null, hasSlides = false): string {
  const slideInstructions = hasSlides
    ? `
This transcript has \`[SLIDE n at MM:SS]\` markers showing when each slide photo appeared, sometimes followed by that slide's own transcribed text/equations/diagram description. Use them:
- Let the slides anchor your section structure where it makes sense — group notes around what a slide covers rather than ignoring the markers.
- When the spoken transcript is unclear, garbled, or missing an equation/term but the corresponding slide's text has it, prefer the slide's version rather than guessing from the audio.
- Whenever a section covers material from a specific slide, mention it in prose as "(Slide n)".
- The FIRST time you introduce a slide's content in a section, put a line by itself right after it containing exactly \`[SLIDE_IMAGE n]\` (with the real slide number, nothing else on that line) so the photo can be inserted there automatically. Never invent a slide number that has no marker in the transcript, and don't repeat the same \`[SLIDE_IMAGE n]\` more than once.
`
    : "";

  return `You are turning a raw lecture transcript into clear, well-structured study notes${courseName ? ` for a course called "${courseName}"` : ""}.
${slideInstructions}
Write the notes in Markdown, in this order:
1. A short summary paragraph (2-4 sentences) of what the lecture covered.
2. The body, organized under \`##\` headings by topic (not by "minute 1, minute 2" — group related material together even if the professor jumped around).
3. **Key terms in bold** the first time they're defined.
4. Equations in LaTeX: inline math as \`$...$\`, block/display math as \`$$...$$\`. For chemistry, use mhchem syntax inside \`\\ce{...}\` (e.g. \`$\\ce{H2SO4}$\`).
5. Worked examples the professor walked through, reproduced with their steps.
6. A "What the professor emphasized" section — anything explicitly flagged as important, likely to be tested, or repeated.

Rules:
- Fix obvious speech-to-text errors using the surrounding context (e.g. a mis-transcribed term that's clearly a course-specific word), but never invent content, examples, or numbers that aren't actually in the transcript. If something is unclear or inaudible, say so rather than guessing.
- Don't editorialize or add filler like "this is an interesting topic" — just the notes.
- Skip a section above if the transcript genuinely has nothing for it (e.g. no worked examples).

After the notes, on their own lines, append exactly 5 suggested flashcards covering the material, as a fenced code block tagged \`json-flashcards\` (not plain \`json\`) containing a JSON array of \`{"front": "...", "back": "..."}\` objects — front is a question or term, back is the answer. Nothing after that fenced block.

Transcript:
"""
${transcript}
"""`;
}

/** The slide-vision prompt (PLAN.md Phase 12 task 5) — shared by nothing else, unlike the notes
 * prompt, since the tesseract.js fallback runs plain OCR rather than following a written prompt. */
export function buildSlideTextPrompt(): string {
  return `Transcribe all text visible in this lecture slide photo. Write any equations in LaTeX (inline as $...$, chemistry with \\ce{...}). For a diagram, chart, or figure with little or no text, briefly describe what it shows in one sentence instead of transcribing nothing. Output only the transcription/description — no preamble, no commentary.`;
}

/** The syllabus-parsing prompt (PLAN.md Phase 13 task 2). Shared by the real Gemini call and the
 * no-key "Copy prompt" fallback; the reply's shape is validated by `parsedSyllabusSchema`
 * (lib/syllabus.ts), which also tolerates a ```json fence around it. */
export function buildSyllabusPrompt(rawText: string, courseName: string | null, year: number): string {
  return `Extract the structure of this course syllabus${courseName ? ` for "${courseName}"` : ""} as JSON.

Reply with ONLY a JSON object (no commentary) of exactly this shape:
{
  "course_name": string | null,
  "instructor": string | null,
  "schedule": [{ "week": number | null, "date": "YYYY-MM-DD" | null, "topics": [string], "readings": [string] }],
  "assessments": [{ "title": string, "kind": "exam" | "quiz" | "assignment" | "project", "date": "YYYY-MM-DD" | null, "weight": number | null, "covers_weeks": [number] | null }],
  "grading": [{ "component": string, "weight": number }],
  "policies_summary": string | null
}

Rules:
- One "schedule" entry per week or class meeting listed. "topics" are short topic names (a few words each, e.g. "Chemical equilibrium"), not full sentences. "date" is that week's first class date if given.
- Dates without a year are in ${year} (or ${year + 1} if the term clearly wraps into the next year). If no specific date is given, use null — never invent one.
- "weight" is a percentage of the final grade (e.g. 25 for 25%), or null if not stated.
- Include every exam, quiz, assignment, and project that has its own due date or grade weight. Midterms and finals are "exam".
- "policies_summary": 2-3 sentences covering attendance, late work, and anything else notable. null if none.
- Only use information actually in the syllabus.

Syllabus:
"""
${rawText}
"""`;
}
