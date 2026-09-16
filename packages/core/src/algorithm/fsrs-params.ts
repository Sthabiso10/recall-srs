/**
 * FSRS parameters and configuration.
 *
 * FSRS (Free Spaced Repetition Scheduler) models memory with three quantities
 * — Difficulty, Stability, Retrievability — and 19 fitted weights. Unlike
 * SM-2's hand-chosen constants, these weights are meant to be *optimised per
 * learner* from their own review history. The defaults below are the
 * population-level starting point.
 *
 * ⚠️ VERIFY THE WEIGHTS BEFORE PRODUCTION.
 *
 * The equations in `fsrs.ts` are stable and well documented, but these 19
 * decimal constants are version-specific and get re-fitted between FSRS
 * releases. Check them against the reference implementation
 * (github.com/open-spaced-repetition — `fsrs-rs` or `py-fsrs`) for the version
 * you intend to match, and treat any mismatch as the reference being right.
 *
 * This matters less than it looks: the whole point of FSRS is that these get
 * replaced by weights fitted to your users' actual review logs. The defaults
 * are a cold start, not a target.
 */

/** FSRS grades. Note this is 1-4, not SM-2's 0-5 — see `toFSRSRating`. */
export type FSRSRating = 1 | 2 | 3 | 4;

export const FSRS_AGAIN: FSRSRating = 1;
export const FSRS_HARD: FSRSRating = 2;
export const FSRS_GOOD: FSRSRating = 3;
export const FSRS_EASY: FSRSRating = 4;

/**
 * The 19 FSRS-5 weights.
 *
 * Roughly, by index:
 *   0-3   initial stability per first grade (Again, Hard, Good, Easy)
 *   4-5   initial difficulty
 *   6     difficulty change per grade
 *   7     mean reversion of difficulty toward the "Easy" baseline
 *   8-10  stability growth after a successful recall
 *   11-14 stability after a lapse
 *   15    hard-grade penalty
 *   16    easy-grade bonus
 *   17-18 same-day (short-term) review adjustment
 */
export const FSRS_5_DEFAULT_WEIGHTS: readonly number[] = [
  0.40255, 1.18385, 3.173, 15.69105, // w0-w3   initial stability
  7.1949, 0.5345, // w4-w5   initial difficulty
  1.4604, // w6      difficulty delta
  0.0046, // w7      mean reversion
  1.54575, 0.1192, 1.01925, // w8-w10  recall stability
  1.9395, 0.11, 0.29605, 2.2698, // w11-w14 lapse stability
  0.2315, // w15     hard penalty
  2.9898, // w16     easy bonus
  0.51655, 0.6621, // w17-w18 short-term
];

/**
 * Forgetting-curve shape constants for FSRS-4.5 and FSRS-5.
 *
 * R(t, S) = (1 + FACTOR · t/S) ^ DECAY
 *
 * These two are chosen together so that R(S, S) = 0.9 exactly — which is what
 * makes "stability" mean "the interval at which you have a 90% chance of
 * recall". `fsrs.test.ts` asserts that identity; if you change one, the test
 * will tell you the definition broke.
 */
export const FSRS_DECAY = -0.5;
export const FSRS_FACTOR = 19 / 81;

export interface FSRSConfig {
  /** The 19 fitted weights. Replace with per-user optimised values when you have them. */
  weights: readonly number[];

  /**
   * Target recall probability, 0-1. **The knob your users actually care about.**
   *
   * 0.9 is the default and a good one. Raising it to 0.95 shortens every
   * interval and roughly doubles daily workload; dropping to 0.85 stretches
   * intervals and trades accuracy for time. Exposing this in your UI is worth
   * more to learners than any amount of weight tuning.
   */
  desiredRetention: number;

  /** Ceiling on any computed interval, in days. Default: 10 years. */
  maximumIntervalDays: number;

  /**
   * Randomised interval jitter as a fraction (0.05 = up to ±5%), to stop cards
   * introduced together from staying welded to the same due date. Canonical
   * FSRS uses banded fuzz rather than a flat ratio; this is the simpler
   * approximation. 0 disables it.
   */
  intervalFuzzRatio: number;

  /**
   * Treat reviews inside this window as same-day and apply the short-term
   * stability formula (w17/w18) instead of the long-term one. Default 1 day.
   */
  shortTermThresholdDays: number;

  /**
   * Whether a lapse sends the card to `relearning`. Turning this off makes
   * lapses reschedule without a relearning phase — faster, and noticeably
   * worse for genuinely forgotten material.
   */
  enableRelearning: boolean;
}

export const DEFAULT_FSRS_CONFIG: FSRSConfig = {
  weights: FSRS_5_DEFAULT_WEIGHTS,
  desiredRetention: 0.9,
  maximumIntervalDays: 365 * 10,
  intervalFuzzRatio: 0,
  shortTermThresholdDays: 1,
  enableRelearning: true,
};

/** FSRS difficulty is defined on [1, 10]; every update clamps back into range. */
export const FSRS_MIN_DIFFICULTY = 1;
export const FSRS_MAX_DIFFICULTY = 10;

/** Stability floor, so a catastrophic lapse cannot drive the interval to zero. */
export const FSRS_MIN_STABILITY = 0.01;
