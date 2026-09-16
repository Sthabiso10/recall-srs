/**
 * FSRS — the pure math.
 *
 * Same contract as `sm2.ts`: total functions of their arguments, no clock, no
 * storage, no randomness. Everything here is unit-testable in isolation, and
 * `test/fsrs.test.ts` pins the invariants.
 *
 * ── The model ───────────────────────────────────────────────────────────
 *
 * FSRS describes a memory with three quantities:
 *
 *   Stability (S)      days until recall probability decays to 90%
 *   Difficulty (D)     1-10, how hard this card is for this learner
 *   Retrievability (R) probability of recall right now, given elapsed time
 *
 * The forgetting curve is a power function:
 *
 *   R(t, S) = (1 + FACTOR · t/S) ^ DECAY
 *
 * and scheduling inverts it — given a target retention r, the interval is the
 * t at which R falls to r:
 *
 *   I(r, S) = (S / FACTOR) · (r ^ (1/DECAY) − 1)
 *
 * That inversion is the whole scheduler. Everything else is bookkeeping about
 * how S and D move after each review.
 *
 * ── Why this instead of SM-2 ────────────────────────────────────────────
 *
 * SM-2 multiplies the interval by an ease factor and hopes. FSRS models the
 * forgetting curve directly, which means it can answer "what interval gives me
 * 90% retention?" — a question SM-2 cannot even express. It also uses the
 * elapsed time since the last review, so an overdue card that you still
 * remember correctly counts as strong evidence of stability. SM-2 throws that
 * information away.
 */

import type { MemoryState } from '../types/index';
import type { FSRSConfig, FSRSRating } from './fsrs-params';
import {
  FSRS_DECAY,
  FSRS_FACTOR,
  FSRS_MAX_DIFFICULTY,
  FSRS_MIN_DIFFICULTY,
  FSRS_MIN_STABILITY,
} from './fsrs-params';

/* ------------------------------------------------------------------ */
/* The forgetting curve                                                */
/* ------------------------------------------------------------------ */

/**
 * Probability of recalling a card `elapsedDays` after its last review.
 *
 * By construction `retrievability(S, S) === 0.9` — that identity is what makes
 * stability mean what it means, and `fsrs.test.ts` asserts it exactly.
 */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  const t = Math.max(0, elapsedDays);
  return Math.pow(1 + FSRS_FACTOR * (t / stability), FSRS_DECAY);
}

/**
 * The interval that lands recall probability on `desiredRetention`.
 *
 * This is the inverse of `retrievability`, and the only place an interval is
 * ever computed. Raise the retention target and every interval shortens.
 */
export function intervalForRetention(
  stability: number,
  desiredRetention: number,
  maximumIntervalDays: number,
  minimumIntervalDays = 1,
): number {
  const clampedRetention = clamp(desiredRetention, 0.5, 0.999);
  const raw = (stability / FSRS_FACTOR) * (Math.pow(clampedRetention, 1 / FSRS_DECAY) - 1);

  // Round to whole days only once past a day. Below that, keep the fraction:
  // a lapsed card is meant to return in minutes, and rounding it up to 1 day
  // would defer it to tomorrow and remove relearning altogether.
  const shaped = raw >= 1 ? Math.round(raw) : raw;
  return clamp(shaped, minimumIntervalDays, maximumIntervalDays);
}

/* ------------------------------------------------------------------ */
/* Initial state — after the very first review                         */
/* ------------------------------------------------------------------ */

/**
 * Initial stability, taken straight from the first grade: w0..w3 for
 * Again/Hard/Good/Easy. A card first rated Easy starts far more stable than
 * one first rated Again, which is why FSRS has no separate "learning steps".
 */
export function initialStability(rating: FSRSRating, config: FSRSConfig): number {
  const w = config.weights[rating - 1] ?? FSRS_MIN_STABILITY;
  return Math.max(w, FSRS_MIN_STABILITY);
}

/** Initial difficulty: D₀(G) = w4 − e^(w5·(G−1)) + 1, clamped to [1, 10]. */
export function initialDifficulty(rating: FSRSRating, config: FSRSConfig): number {
  const w4 = config.weights[4] ?? 7.1949;
  const w5 = config.weights[5] ?? 0.5345;
  return clampDifficulty(w4 - Math.exp(w5 * (rating - 1)) + 1);
}

/* ------------------------------------------------------------------ */
/* Difficulty update                                                   */
/* ------------------------------------------------------------------ */

/**
 * Move difficulty after a review.
 *
 *   ΔD  = −w6 · (G − 3)                     grades above Good make it easier
 *   D'  = D + ΔD · (10 − D)/9               linear damping near the ceiling
 *   D'' = w7 · D₀(Easy) + (1 − w7) · D'     slow reversion to the baseline
 *
 * The damping term is what stops a run of Hard grades from pinning every card
 * at 10 forever; the mean reversion is what lets a card recover once it stops
 * being hard. Both matter more than they look.
 */
export function nextDifficulty(
  difficulty: number,
  rating: FSRSRating,
  config: FSRSConfig,
): number {
  const w6 = config.weights[6] ?? 1.4604;
  const w7 = config.weights[7] ?? 0.0046;

  const delta = -w6 * (rating - 3);
  const damped = difficulty + delta * ((10 - difficulty) / 9);
  const baseline = initialDifficulty(4, config);

  return clampDifficulty(w7 * baseline + (1 - w7) * damped);
}

/* ------------------------------------------------------------------ */
/* Stability update                                                    */
/* ------------------------------------------------------------------ */

/**
 * Stability after a successful recall (Hard, Good or Easy).
 *
 *   S' = S · (1 + e^w8 · (11 − D) · S^(−w9) · (e^(w10·(1−R)) − 1) · hard · easy)
 *
 * Read the terms: easier cards (low D) gain more, already-stable cards gain
 * proportionally less, and — the important one — a *lower* R at review time
 * produces a *larger* gain. Recalling something you were about to forget is
 * worth more than recalling something you just saw. That is the spacing effect,
 * modelled explicitly, and it is what SM-2 has no way to represent.
 */
export function stabilityAfterRecall(
  stability: number,
  difficulty: number,
  retrievabilityAtReview: number,
  rating: FSRSRating,
  config: FSRSConfig,
): number {
  const w8 = config.weights[8] ?? 1.54575;
  const w9 = config.weights[9] ?? 0.1192;
  const w10 = config.weights[10] ?? 1.01925;
  const hardPenalty = rating === 2 ? (config.weights[15] ?? 0.2315) : 1;
  const easyBonus = rating === 4 ? (config.weights[16] ?? 2.9898) : 1;

  const growth =
    Math.exp(w8) *
    (11 - difficulty) *
    Math.pow(stability, -w9) *
    (Math.exp(w10 * (1 - retrievabilityAtReview)) - 1) *
    hardPenalty *
    easyBonus;

  return Math.max(stability * (1 + growth), FSRS_MIN_STABILITY);
}

/**
 * Stability after a lapse (Again).
 *
 *   S' = w11 · D^(−w12) · ((S+1)^w13 − 1) · e^(w14·(1−R))
 *
 * FSRS-5 additionally caps this at the pre-lapse stability: forgetting a card
 * can never leave it more durable than it was. Without that clamp the formula
 * can produce a *higher* stability for a very stable card that lapses, which
 * is obviously wrong and was a real bug in earlier versions.
 */
export function stabilityAfterLapse(
  stability: number,
  difficulty: number,
  retrievabilityAtReview: number,
  config: FSRSConfig,
): number {
  const w11 = config.weights[11] ?? 1.9395;
  const w12 = config.weights[12] ?? 0.11;
  const w13 = config.weights[13] ?? 0.29605;
  const w14 = config.weights[14] ?? 2.2698;

  const postLapse =
    w11 *
    Math.pow(difficulty, -w12) *
    (Math.pow(stability + 1, w13) - 1) *
    Math.exp(w14 * (1 - retrievabilityAtReview));

  return clamp(postLapse, FSRS_MIN_STABILITY, stability);
}

/**
 * Stability for a same-day review: S' = S · e^(w17 · (G − 3 + w18)).
 *
 * Same-day repeats carry almost no spacing information, so they move stability
 * only slightly. Without this branch, drilling a card five times in a minute
 * would inflate its interval to months.
 */
export function stabilityShortTerm(
  stability: number,
  rating: FSRSRating,
  config: FSRSConfig,
): number {
  const w17 = config.weights[17] ?? 0.51655;
  const w18 = config.weights[18] ?? 0.6621;
  return Math.max(stability * Math.exp(w17 * (rating - 3 + w18)), FSRS_MIN_STABILITY);
}

/* ------------------------------------------------------------------ */
/* One full step                                                       */
/* ------------------------------------------------------------------ */

/**
 * Apply one graded review to a memory state.
 *
 * Pure: returns a new `MemoryState`, never mutates the input. Pass
 * `memory: null` for a card's first review and it produces the initial state
 * from the grade alone.
 */
export function applyFSRS(
  memory: MemoryState | null,
  rating: FSRSRating,
  elapsedDays: number,
  config: FSRSConfig,
): MemoryState {
  if (!memory) {
    return {
      stability: initialStability(rating, config),
      difficulty: initialDifficulty(rating, config),
    };
  }

  const r = retrievability(elapsedDays, memory.stability);
  const difficulty = nextDifficulty(memory.difficulty, rating, config);

  let stability: number;
  if (elapsedDays < config.shortTermThresholdDays) {
    stability = stabilityShortTerm(memory.stability, rating, config);
  } else if (rating === 1) {
    stability = stabilityAfterLapse(memory.stability, memory.difficulty, r, config);
  } else {
    stability = stabilityAfterRecall(memory.stability, memory.difficulty, r, rating, config);
  }

  return { stability, difficulty };
}

/* ------------------------------------------------------------------ */
/* Grade mapping                                                       */
/* ------------------------------------------------------------------ */

/**
 * Map SM-2's 0-5 quality onto FSRS's 1-4 rating.
 *
 * This is lossy, and deliberately so. The alternative — a second grading scale
 * threaded through `Card`, `ReviewLog`, every adapter and every component —
 * buys nothing: FSRS has four buttons, most apps show four buttons, and the
 * 0/1/2 distinction in SM-2 was always more precision than learners can
 * honestly supply.
 *
 *   0, 1, 2 → Again (1)    any failure to recall
 *   3       → Hard  (2)
 *   4       → Good  (3)
 *   5       → Easy  (4)
 *
 * If you show the full six-button scale *and* run FSRS, know that 0, 1 and 2
 * are indistinguishable to the scheduler — show four buttons instead.
 */
export function toFSRSRating(quality: number): FSRSRating {
  if (quality <= 2) return 1;
  if (quality === 3) return 2;
  if (quality === 4) return 3;
  return 4;
}

/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampDifficulty(value: number): number {
  return clamp(value, FSRS_MIN_DIFFICULTY, FSRS_MAX_DIFFICULTY);
}
