/**
 * Learning and relearning ladders.
 *
 * FSRS schedules from stability alone, and in principle needs no short steps:
 * a card first rated Again gets w0 ≈ 0.2 days and comes back in five hours.
 * In practice five hours is the wrong answer. The learner is sitting there
 * now, the material is in working memory now, and the cheapest correct
 * repetition available is one minute from now. Every shipped SRS — Anki, and
 * the FSRS reference implementation itself — puts a short ladder in front of
 * the long-term curve for exactly this reason.
 *
 * Two ladders, same machinery:
 *
 *   learning     walked by brand-new cards, before they ever graduate
 *   relearning   walked by review cards that lapsed
 *
 * ── Which grade does what ───────────────────────────────────────────────
 *
 * On a ladder (a `new`, `learning` or `relearning` card):
 *
 *   Again   back to the first step
 *   Hard    stay on this step, but come back sooner than Good would —
 *           the midpoint of the first two steps, or 1.5× the only step
 *   Good    advance one step; graduate if there is no next step
 *   Easy    graduate immediately, however far up the ladder the card is
 *
 * On a `review` card, only Again engages the ladder; Hard, Good and Easy all
 * schedule from the forgetting curve as usual.
 *
 * Ported from `open-spaced-repetition/ts-fsrs` (MIT)
 * `BasicLearningStepsStrategy`.
 */

import type { FSRSRating } from './fsrs-params';

/** Where a graded card lands on the ladder. `null` means "graduate". */
export interface StepOutcome {
  /** Minutes from now until the card is due again. */
  minutes: number;
  /** The ladder index to record on the card. */
  step: number;
}

/**
 * Resolve one grade against a ladder.
 *
 * Returns `null` when the card should leave the ladder and be scheduled from
 * its stability instead — which happens on Easy, on Good past the last step,
 * on any passing grade for a review card, and whenever the ladder is empty.
 *
 * `fromReview` distinguishes a review card falling onto the relearning ladder
 * (only Again does) from a card already walking one (every grade means
 * something).
 */
export function resolveStep(
  steps: readonly number[],
  currentStep: number,
  rating: FSRSRating,
  fromReview: boolean,
): StepOutcome | null {
  // An empty ladder, or a card somehow parked past the end of one, graduates.
  if (steps.length === 0 || currentStep >= steps.length) return null;

  const first = steps[0] as number;

  if (fromReview) {
    // A review card only drops onto the ladder when it is forgotten.
    if (rating !== 1) return null;
    return { minutes: steps[Math.max(0, currentStep)] ?? first, step: 0 };
  }

  switch (rating) {
    case 1:
      return { minutes: first, step: 0 };

    case 2: {
      // Hard holds the card on its current step. It needs an interval of its
      // own: reusing this step's would make Hard and a repeated Again
      // indistinguishable, and reusing the next step's would make it Good.
      const raw = steps.length === 1 ? first * 1.5 : (first + (steps[1] as number)) / 2;
      // Whole minutes once past a minute, exact below it — the same shaping
      // `intervalForRetention` applies at the day boundary, so a sub-minute
      // ladder stays usable instead of rounding to zero.
      return { minutes: raw >= 1 ? Math.round(raw) : raw, step: currentStep };
    }

    case 3: {
      const next = steps[currentStep + 1];
      return next === undefined ? null : { minutes: next, step: currentStep + 1 };
    }

    case 4:
    default:
      return null;
  }
}
