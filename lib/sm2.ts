import { addDays } from "date-fns";

/** The four grades a reviewer picks; mapped to the SM-2 algorithm's 0-5 quality scale. */
export type Grade = "again" | "hard" | "good" | "easy";

const GRADE_QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export type SM2Card = {
  ease: number;
  intervalDays: number;
  repetitions: number;
};

/**
 * The classic SM-2 spaced-repetition algorithm (SuperMemo 2). A quality below 3 ("Again")
 * always resets the card to relearning (repetitions 0, due tomorrow); 3 and up grows the
 * interval, first to 1 day, then 6 days, then by multiplying by the ease factor. Ease is
 * nudged every review, regardless of pass/fail, and never drops below 1.3.
 */
export function schedule(card: SM2Card, grade: Grade, now: Date = new Date()): SM2Card & { dueAt: Date } {
  const quality = GRADE_QUALITY[grade];
  let { ease, intervalDays, repetitions } = card;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * ease);
    repetitions += 1;
  }

  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  return { ease, intervalDays, repetitions, dueAt: addDays(now, intervalDays) };
}

/** A fresh card's starting state (matches the `flashcards` table's column defaults). */
export const NEW_CARD: SM2Card = { ease: 2.5, intervalDays: 0, repetitions: 0 };
