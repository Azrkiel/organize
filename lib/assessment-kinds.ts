/** Kept apart from lib/syllabus.ts so client components can use it without bundling zod. */
export const ASSESSMENT_KINDS = ["exam", "quiz", "assignment", "project"] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];
