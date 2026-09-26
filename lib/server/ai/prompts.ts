/** The lecture-notes prompt (PLAN.md Phase 10 task 2). Shared by the real Gemini call and the
 * no-key "Copy prompt for Claude" fallback, so both paths produce notes in the same shape. */
export function buildLectureNotesPrompt(transcript: string, courseName: string | null): string {
  return `You are turning a raw lecture transcript into clear, well-structured study notes${courseName ? ` for a course called "${courseName}"` : ""}.

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
