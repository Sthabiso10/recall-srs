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
 * Under FSRS-5 the curve's shape was fixed (DECAY = −0.5). Under FSRS-6 it is
 * w20, fitted per learner, and FACTOR is derived from it so that R(S, S) = 0.9
 * still holds — see `decayFactorFor`.
 *
 * ── Why this instead of SM-2 ────────────────────────────────────────────
 *
 * SM-2 multiplies the interval by an ease factor and hopes. FSRS models the
 * forgetting curve directly, which means it can answer "what interval gives me
 * 90% retention?" — a question SM-2 cannot even express. It also uses the
 * elapsed time since the last review, so an overdue card that you still
 * remember correctly counts as strong evidence of stability. SM-2 throws that
 * information away.
 *
 * ── Provenance ──────────────────────────────────────────────────────────
 *
 * Every formula below was checked against `open-spaced-repetition/ts-fsrs`
 * (MIT) and `open-spaced-repetition/py-fsrs` (MIT), which agree with each
 * other. Where this file once diverged, the reference won.
 */

import type { MemoryState } from '../types/index';
import type { FSRSConfig, FSRSRating } from './fsrs-params';
import {
  FSRS_MAX_DIFFICULTY,
  FSRS_MAX_INITIAL_STABILITY,
  FSRS_MAX_STABILITY,
  FSRS_MIN_DIFFICULTY,
  FSRS_MIN_STABILITY,
  FSRS_6_DEFAULT_WEIGHTS,
  decayFactorFor,
  migrateWeights,
} from './fsrs-params';

/* ------------------------------------------------------------------ */
/* Weight resolution                                                   */
/* ------------------------------------------------------------------ */

/**
 * Migration is pure and the same vector is read on every single review, so
 * cache by identity. Configs are long-lived objects, which makes this a hit
 * essentially always; a `WeakMap` keeps it from pinning discarded ones.
 */
const resolvedWeights = new WeakMap<object, readonly number[]>();

/**
 * Read a config's weights as a full 21-entry FSRS-6 vector.
 *
 * A 19- or 17-entry vector is migrated, not padded — the difference matters,
 * because FSRS-4.5's w4/w5/w6 mean something different from FSRS-6's and
 * copying them across unchanged produces a scheduler that matches no published
 * algorithm.
 */
function weightsOf(config: FSRSConfig): readonly number[] {
  const source = config.weights;
  const cached = resolvedWeights.get(source as unknown as object);
  if (cached) return cached;

  const migrated =
    source.length === 21 ? source : (migrateWeights(source) as readonly number[]);
  resolvedWeights.set(source as unknown as object, migrated);
  return migrated;
}

/** Is short-term (same-day) scheduling active for this config? */
function shortTermEnabled(config: FSRSConfig): boolean {
  return config.shortTermThresholdDays > 0;
}

/* ------------------------------------------------------------------ */
/* The forgetting curve                                                */
/* ------------------------------------------------------------------ */

/**
 * Probability of recalling a card `elapsedDays` after its last review.
 *
 * By construction `retrievability(S, S) === 0.9` for any weight vector — that
 * identity is what makes stability mean what it means, and `fsrs.test.ts`
 * asserts it exactly for both FSRS-5 and FSRS-6 weights.
 *
 * `weights` defaults to the FSRS-6 population vector, matching
 * `DEFAULT_FSRS_CONFIG`. Pass a learner's own vector to use their fitted decay.
 */
export function retrievability(
  elapsedDays: number,
  stability: number,
  weights: readonly number[] = FSRS_6_DEFAULT_WEIGHTS,
): number {
  if (stability <= 0) return 0;
  const { decay, factor } = decayFactorFor(weights);
  const t = Math.max(0, elapsedDays);
  return Math.pow(1 + factor * (t / stability), decay);
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
  weights: readonly number[] = FSRS_6_DEFAULT_WEIGHTS,
): number {
  const { decay, factor } = decayFactorFor(weights);
  const clampedRetention = clamp(desiredRetention, 0.5, 0.999);
  const raw = (stability / factor) * (Math.pow(clampedRetention, 1 / decay) - 1);

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
 *
 * Capped at 100 days rather than the global 36500: a single first review
 * cannot legitimately establish a memory good for a century, and an optimiser
 * that fitted w3 that high has found noise.
 */
export function initialStability(rating: FSRSRating, config: FSRSConfig): number {
  const w = weightsOf(config)[rating - 1] ?? FSRS_MIN_STABILITY;
  return clamp(w, FSRS_MIN_STABILITY, FSRS_MAX_INITIAL_STABILITY);
}

/**
 * Initial difficulty: D₀(G) = w4 − e^(w5·(G−1)) + 1, clamped to [1, 10].
 *
 * The clamp is correct *here* — a card's difficulty is defined on [1, 10]. It
 * is deliberately absent from the copy of this formula used inside
 * `nextDifficulty`; see the note there, it is not an oversight.
 */
export function initialDifficulty(rating: FSRSRating, config: FSRSConfig): number {
  return clampDifficulty(rawInitialDifficulty(rating, config));
}

/** D₀(G) before the [1, 10] clamp. */
function rawInitialDifficulty(rating: FSRSRating, config: FSRSConfig): number {
  const w = weightsOf(config);
  const w4 = w[4] as number;
  const w5 = w[5] as number;
  return w4 - Math.exp(w5 * (rating - 1)) + 1;
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
 *
 * ⚠️ The D₀(Easy) baseline is deliberately **unclamped**. Under FSRS-5's
 * weights D₀(4) ≈ 3.2 and clamping it to [1, 10] changed nothing, so the
 * distinction was invisible. Under FSRS-6's weights D₀(4) ≈ −4.77 — clamping
 * it to 1 makes the reversion target nearly six points too high, and every
 * card in the collection drifts harder than it should. Both reference
 * implementations pass the raw value (py-fsrs spells it
 * `_initial_difficulty(rating=Easy, clamp=False)`); only the *result* of the
 * reversion is clamped, on the line below.
 */
export function nextDifficulty(
  difficulty: number,
  rating: FSRSRating,
  config: FSRSConfig,
): number {
  const w = weightsOf(config);
  const w6 = w[6] as number;
  const w7 = w[7] as number;

  const delta = -w6 * (rating - 3);
  const damped = difficulty + (delta * (10 - difficulty)) / 9;
  const baseline = rawInitialDifficulty(4, config);

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
  const w = weightsOf(config);
  const w8 = w[8] as number;
  const w9 = w[9] as number;
  const w10 = w[10] as number;
  const hardPenalty = rating === 2 ? (w[15] as number) : 1;
  const easyBonus = rating === 4 ? (w[16] as number) : 1;

  const growth =
    Math.exp(w8) *
    (11 - difficulty) *
    Math.pow(stability, -w9) *
    (Math.exp(w10 * (1 - retrievabilityAtReview)) - 1) *
    hardPenalty *
    easyBonus;

  return clamp(stability * (1 + growth), FSRS_MIN_STABILITY, FSRS_MAX_STABILITY);
}

/**
 * Stability after a lapse (Again).
 *
 *   S'_long  = w11 · D^(−w12) · ((S+1)^w13 − 1) · e^(w14·(1−R))
 *   S'_short = S / e^(w17 · w18)
 *   S'       = min(S'_long, S'_short)
 *
 * The second term is the one that is easy to get wrong. Forgetting a card must
 * leave it *less* durable than it was, so the result is capped — but the cap
 * is not S itself. With short-term scheduling on, the most a lapse can leave
 * behind is `S / e^(w17·w18)`, strictly below S; capping at S instead lets a
 * lapse on a very stable card return almost the whole of its old stability,
 * which reschedules a card the learner just failed nearly as far out as if
 * they had passed it. Both reference implementations use the `S/e^(w17·w18)`
 * cap (ts-fsrs `next_s_min`, py-fsrs `next_forget_stability_short_term_params`).
 *
 * With short-term scheduling disabled (`shortTermThresholdDays: 0`), w17 and
 * w18 drop out and the cap degenerates to S — the reference's
 * `enable_short_term: false` branch.
 */
export function stabilityAfterLapse(
  stability: number,
  difficulty: number,
  retrievabilityAtReview: number,
  config: FSRSConfig,
): number {
  const w = weightsOf(config);
  const w11 = w[11] as number;
  const w12 = w[12] as number;
  const w13 = w[13] as number;
  const w14 = w[14] as number;

  const longTerm =
    w11 *
    Math.pow(difficulty, -w12) *
    (Math.pow(stability + 1, w13) - 1) *
    Math.exp(w14 * (1 - retrievabilityAtReview));

  const w17 = shortTermEnabled(config) ? (w[17] as number) : 0;
  const w18 = shortTermEnabled(config) ? (w[18] as number) : 0;
  const shortTermCap = stability / Math.exp(w17 * w18);

  return clamp(
    Math.min(longTerm, shortTermCap),
    FSRS_MIN_STABILITY,
    FSRS_MAX_STABILITY,
  );
}

/**
 * Stability for a same-day review.
 *
 *   sinc = S^(−w19) · e^(w17 · (G − 3 + w18))
 *   S'   = S · (G ≥ Hard ? max(sinc, 1) : sinc)
 *
 * Same-day repeats carry almost no spacing information, so they move stability
 * only slightly. Without this branch, drilling a card five times in a minute
 * would inflate its interval to months.
 *
 * Two FSRS-6 details that FSRS-5 lacked, both load-bearing:
 *
 *   S^(−w19) makes the same-day gain shrink as the card gets stable. Under
 *   FSRS-5 a same-day Good multiplied a one-day card and a one-year card by the
 *   same factor, which is not how re-reading something works.
 *
 *   max(sinc, 1) for Hard/Good/Easy guarantees a *passing* same-day grade never
 *   reduces stability. Without it, a Hard on a stable card can shrink it —
 *   getting a card right and being punished for it.
 */
export function stabilityShortTerm(
  stability: number,
  rating: FSRSRating,
  config: FSRSConfig,
): number {
  const w = weightsOf(config);
  const w17 = w[17] as number;
  const w18 = w[18] as number;
  const w19 = w[19] ?? 0;

  const sinc = Math.pow(stability, -w19) * Math.exp(w17 * (rating - 3 + w18));
  const masked = rating >= 2 ? Math.max(sinc, 1) : sinc;

  return clamp(stability * masked, FSRS_MIN_STABILITY, FSRS_MAX_STABILITY);
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

  const r = retrievability(elapsedDays, memory.stability, weightsOf(config));
  const difficulty = nextDifficulty(memory.difficulty, rating, config);

  let stability: number;
  if (shortTermEnabled(config) && elapsedDays < config.shortTermThresholdDays) {
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
