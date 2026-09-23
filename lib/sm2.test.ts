import { describe, expect, it } from "vitest";
import { schedule, NEW_CARD, type SM2Card } from "./sm2";

const NOW = new Date(2026, 8, 21, 12, 0, 0); // Monday, Sep 21 2026, noon.

describe("schedule", () => {
  it("grows the interval 1 -> 6 -> ease-multiplied on repeated 'good' grades, ease unchanged", () => {
    let card: SM2Card = NEW_CARD;

    card = schedule(card, "good", NOW);
    expect(card).toMatchObject({ repetitions: 1, intervalDays: 1, ease: 2.5 });

    card = schedule(card, "good", NOW);
    expect(card).toMatchObject({ repetitions: 2, intervalDays: 6, ease: 2.5 });

    card = schedule(card, "good", NOW);
    expect(card).toMatchObject({ repetitions: 3, intervalDays: 15, ease: 2.5 }); // round(6 * 2.5)

    card = schedule(card, "good", NOW);
    expect(card).toMatchObject({ repetitions: 4, intervalDays: 38, ease: 2.5 }); // round(15 * 2.5)
  });

  it("raises ease on 'easy' and lowers it on 'hard', per the standard SM-2 deltas", () => {
    const hard = schedule(NEW_CARD, "hard", NOW);
    expect(hard.ease).toBeCloseTo(2.36, 5); // 2.5 - 0.14
    expect(hard).toMatchObject({ repetitions: 1, intervalDays: 1 });

    const easy = schedule(NEW_CARD, "easy", NOW);
    expect(easy.ease).toBeCloseTo(2.6, 5); // 2.5 + 0.1
    expect(easy).toMatchObject({ repetitions: 1, intervalDays: 1 });
  });

  it("'again' resets repetitions and interval to relearning, and never drops ease below 1.3", () => {
    let card: SM2Card = { ease: 2.5, intervalDays: 15, repetitions: 3 };
    card = schedule(card, "again", NOW);
    expect(card).toMatchObject({ repetitions: 0, intervalDays: 1 });
    expect(card.ease).toBeCloseTo(1.96, 5); // 2.5 - 0.54

    // A low-ease card failing again must clamp, not go negative.
    const floored = schedule({ ease: 1.3, intervalDays: 1, repetitions: 0 }, "again", NOW);
    expect(floored.ease).toBe(1.3);
  });

  it("computes dueAt as now plus the new interval", () => {
    const card = schedule(NEW_CARD, "good", NOW);
    expect(card.dueAt.toISOString()).toBe(new Date(2026, 8, 22, 12, 0, 0).toISOString());
  });
});
