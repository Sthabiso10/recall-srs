/**
 * FSRS parameters and configuration.
 *
 * FSRS (Free Spaced Repetition Scheduler) models memory with three quantities
 * — Difficulty, Stability, Retrievability — and a vector of fitted weights.
 * Unlike SM-2's hand-chosen constants, these weights are meant to be
 * *optimised per learner* from their own review history. The defaults below
 * are the population-level starting point.
 *
 * ── Provenance ──────────────────────────────────────────────────────────
 *
 * The weights, bounds, migration table and forgetting-curve constants in this
 * file were verified against two independent reference implementations from
 * the algorithm's own maintainers:
 *
 *   open-spaced-repetition/ts-fsrs  (MIT) — packages/fsrs/src/{constant,algorithm,default}.ts
 *   open-spaced-repetition/py-fsrs  (MIT) — fsrs/scheduler.py
 *
 * Both agree on every constant here. When they are re-fitted upstream, treat
 * the reference as right and this file as stale.
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
 * The 19 FSRS-5 weights. Kept for migrating stored weight vectors and for
 * reproducing FSRS-5 scheduling exactly; new deployments want
 * {@link FSRS_6_DEFAULT_WEIGHTS}.
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
 * The 21 FSRS-6 weights — the current population defaults.
 *
 * FSRS-6 adds two parameters on top of FSRS-5:
 *
 *   w19  short-term stability's dependence on current stability (S^-w19).
 *        Without it, drilling an already-stable card same-day inflated it as
 *        much as drilling a brand-new one.
 *   w20  the decay of the forgetting curve itself, previously the hard-coded
 *        0.5. Some learners' memories decay faster than others, and FSRS-6
 *        fits that rather than assuming it.
 *
 * Verified identical in ts-fsrs `default_w` and py-fsrs `DEFAULT_PARAMETERS`.
 */
export const FSRS_6_DEFAULT_WEIGHTS: readonly number[] = [
  0.212, 1.2931, 2.3065, 8.2956, // w0-w3   initial stability
  6.4133, 0.8334, // w4-w5   initial difficulty
  3.0194, // w6      difficulty delta
  0.001, // w7      mean reversion
  1.8722, 0.1666, 0.796, // w8-w10  recall stability
  1.4835, 0.0614, 0.2629, 1.6483, // w11-w14 lapse stability
  0.6014, // w15     hard penalty
  1.8729, // w16     easy bonus
  0.5425, 0.0912, // w17-w18 short-term
  0.0658, // w19     short-term stability saturation
  0.1542, // w20     forgetting-curve decay
];

/** How many weights each FSRS version expects. */
export const FSRS_5_WEIGHT_COUNT = 19;
export const FSRS_6_WEIGHT_COUNT = 21;

/**
 * Default decay per version. FSRS-5 fixed it at 0.5; FSRS-6 fits it as w20.
 *
 * Note the sign convention: the *weight* is positive, the exponent in the
 * forgetting curve is its negation. `decayFactorFor` does that flip so no
 * caller has to remember it.
 */
export const FSRS_5_DEFAULT_DECAY = 0.5;
export const FSRS_6_DEFAULT_DECAY = 0.1542;

/**
 * Forgetting-curve shape constants for FSRS-4.5 and FSRS-5, kept as exports
 * because they were part of the public API before FSRS-6 made decay learnable.
 *
 *   R(t, S) = (1 + FACTOR · t/S) ^ DECAY
 *
 * These two are chosen together so that R(S, S) = 0.9 exactly — which is what
 * makes "stability" mean "the interval at which you have a 90% chance of
 * recall". Under FSRS-6 the same identity holds for *any* w20, because FACTOR
 * is derived from DECAY precisely to preserve it; `decayFactorFor` is the
 * generalisation, and `fsrs.test.ts` asserts the identity for both.
 */
export const FSRS_DECAY = -FSRS_5_DEFAULT_DECAY;
export const FSRS_FACTOR = 19 / 81;

/** Round to `decimals` places, matching the reference implementations' `roundTo`. */
export function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

/**
 * Derive the forgetting curve's shape from a weight vector.
 *
 *   decay  = -w20
 *   factor = e^(ln 0.9 / decay) - 1
 *
 * The factor is not free: it is whatever makes R(S, S) = 0.9 hold for the
 * given decay. Hard-coding 19/81 (correct only for decay = -0.5) alongside a
 * learned w20 silently breaks the definition of stability, so always derive
 * the pair together.
 *
 * Weight vectors shorter than 21 entries are treated as FSRS-5 and get
 * decay -0.5 / factor 19/81 back, which is exactly the old behaviour.
 */
export function decayFactorFor(weights: readonly number[]): {
  decay: number;
  factor: number;
} {
  const w20 = weights[20] ?? FSRS_5_DEFAULT_DECAY;
  const decay = -w20;
  const factor = roundTo(Math.exp(Math.log(0.9) / decay) - 1, 8);
  return { decay, factor };
}

/**
 * Bring a stored weight vector up to FSRS-6's 21 entries.
 *
 * Learners' optimised weights outlive algorithm versions — someone who fitted
 * 19 weights last year should not have their history silently rescheduled
 * under population defaults. The conversions below are the reference
 * implementation's (`ts-fsrs` `migrateParameters`), and are chosen so the
 * migrated vector reproduces the *old* scheduling, not FSRS-6's:
 *
 *   19 → 21   append w19 = 0 (no stability saturation) and w20 = 0.5
 *             (FSRS-5's fixed decay). Exactly FSRS-5 behaviour.
 *   17 → 21   FSRS-4.5's difficulty parameters are re-expressed first, then
 *             w17/w18/w19 are zeroed (4.5 had no short-term term) and w20
 *             set to 0.5.
 *
 * A vector that is already 21 long is returned as-is. Anything else throws —
 * silently substituting defaults would hide a real data problem.
 */
export function migrateWeights(weights: readonly number[]): number[] {
  switch (weights.length) {
    case FSRS_6_WEIGHT_COUNT:
      return Array.from(weights);

    case FSRS_5_WEIGHT_COUNT:
      return [...weights, 0, FSRS_5_DEFAULT_DECAY];

    case 17: {
      const w = Array.from(weights);
      const w4 = w[4] as number;
      const w5 = w[5] as number;
      const w6 = w[6] as number;
      w[4] = roundTo(w5 * 2 + w4, 8);
      w[5] = roundTo(Math.log(w5 * 3 + 1) / 3, 8);
      w[6] = roundTo(w6 + 0.5, 8);
      return [...w, 0, 0, 0, FSRS_5_DEFAULT_DECAY];
    }

    default:
      throw new RangeError(
        `Cannot migrate a ${weights.length}-weight vector. FSRS weights come in ` +
          `17 (FSRS-4.5), ${FSRS_5_WEIGHT_COUNT} (FSRS-5) or ${FSRS_6_WEIGHT_COUNT} ` +
          '(FSRS-6) entries; anything else is not a weight vector this library can read.',
      );
  }
}

export interface FSRSConfig {
  /**
   * The fitted weights: 21 for FSRS-6, 19 for FSRS-5, 17 for FSRS-4.5. Short
   * vectors are migrated on use, so a stored FSRS-5 vector keeps scheduling
   * like FSRS-5. Replace with per-user optimised values when you have them.
   */
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

  /**
   * Ceiling on any computed interval, in days. Default is one year — see the
   * note on SM-2's equivalent; ten years is reachable in four Easy grades.
   */
  maximumIntervalDays: number;

  /**
   * Floor on a computed interval, in days. Fractions are allowed and expected:
   * the default of ~10 minutes is what lets a lapsed card come back inside the
   * same session instead of vanishing until tomorrow.
   */
  minimumIntervalDays: number;

  /** Hour at which a new study day begins, 0-23. See SM-2's equivalent. */
  dayStartsAtHour: number;

  /**
   * Interval jitter, to stop cards introduced together from staying welded to
   * the same due date forever.
   *
   * `'banded'` is the reference implementation's scheme: the spread widens
   * with the interval (±15% of the portion between 2.5 and 7 days, ±10% of
   * 7-20, ±5% beyond) and intervals under 2.5 days are left alone, because
   * jittering a two-day interval can only move it to one or three — a 50%
   * swing dressed up as a nudge.
   *
   * `'ratio'` is the older flat-percentage approximation, kept so existing
   * configurations schedule as they did. `'none'` is the default and disables
   * jitter entirely.
   */
  fuzzMode: 'banded' | 'ratio' | 'none';

  /**
   * Spread for `fuzzMode: 'ratio'` as a fraction (0.05 = up to ±5%). Ignored
   * by the other modes.
   */
  intervalFuzzRatio: number;

  /**
   * Treat reviews inside this window as same-day and apply the short-term
   * stability formula (w17/w18/w19) instead of the long-term one. Default 1 day.
   *
   * Set to 0 to disable short-term scheduling entirely, which also removes the
   * short-term cap on post-lapse stability — the reference implementation's
   * `enable_short_term: false`.
   */
  shortTermThresholdDays: number;

  /**
   * Whether a lapse sends the card to `relearning`. Turning this off makes
   * lapses reschedule without a relearning phase — faster, and noticeably
   * worse for genuinely forgotten material.
   */
  enableRelearning: boolean;

  /**
   * Learning ladder, in minutes, walked by a brand-new card before it joins
   * the long-term curve. Defaults to `[1, 10]`, matching the reference
   * implementation and Anki.
   *
   * FSRS does not strictly need this: initial stability comes from the first
   * grade, so a card first rated Again would be scheduled ~5 hours out on its
   * own. Five hours is the wrong answer to "I have never seen this before and
   * just got it wrong". The learner is here now and the material is in working
   * memory now, so the cheapest correct repetition is a minute from now.
   *
   * Grades move a card along the ladder rather than off it: Again returns to
   * the first step, Hard holds position, Good advances one, and Easy
   * graduates immediately. See `algorithm/steps.ts`.
   *
   * Set to `[]` to schedule new cards straight from FSRS, which is how this
   * package behaved before learning steps existed.
   */
  learningStepsMinutes: number[];

  /**
   * Relearning ladder, in minutes, walked after a lapse before the card returns
   * to the long-term curve.
   *
   * This is separate from the FSRS interval on purpose. FSRS computes post-lapse
   * stability that often works out near a day, which would mean a card you just
   * failed disappears until tomorrow — the worst possible moment to stop
   * practising it. The ladder gives the learner another attempt while the
   * material is still in working memory; FSRS then takes over on graduation.
   *
   * Set to `[]` to graduate straight back to the FSRS interval.
   */
  relearningStepsMinutes: number[];
}

export const DEFAULT_FSRS_CONFIG: FSRSConfig = {
  weights: FSRS_6_DEFAULT_WEIGHTS,
  desiredRetention: 0.9,
  maximumIntervalDays: 365,
  minimumIntervalDays: 10 / (24 * 60), // ten minutes
  dayStartsAtHour: 4,
  fuzzMode: 'none',
  intervalFuzzRatio: 0,
  shortTermThresholdDays: 1,
  enableRelearning: true,
  learningStepsMinutes: [1, 10],
  relearningStepsMinutes: [10],
};

/** FSRS difficulty is defined on [1, 10]; every update clamps back into range. */
export const FSRS_MIN_DIFFICULTY = 1;
export const FSRS_MAX_DIFFICULTY = 10;

/**
 * Stability bounds, matching the reference implementations' `S_MIN` / `S_MAX`.
 *
 * The floor stops a catastrophic lapse driving the interval to zero. The
 * ceiling matters more than it looks: stability is multiplied on every
 * successful recall, so without a cap a long-lived card's stability grows
 * without bound and eventually overflows to `Infinity`, at which point every
 * interval it produces is `NaN`.
 */
export const FSRS_MIN_STABILITY = 0.001;
export const FSRS_MAX_STABILITY = 36500;

/**
 * Ceiling on *initial* stability specifically. A first review cannot
 * legitimately establish a memory good for a century, so the reference
 * implementations clamp w0-w3 to 100 days separately from the global cap.
 */
export const FSRS_MAX_INITIAL_STABILITY = 100;

/**
 * `[min, max]` per weight index.
 *
 * Verified against `ts-fsrs`'s `CLAMP_PARAMETERS` and `py-fsrs`'s
 * `LOWER_BOUNDS_PARAMETERS` / `UPPER_BOUNDS_PARAMETERS`, which agree entry for
 * entry. Used both to validate supplied weights and to keep the optimiser
 * inside the region where the model still describes memory.
 *
 * The w19 floor is conditional upstream (0.01 with short-term scheduling on,
 * 0 with it off); 0 is used here so the bound is valid in both modes.
 */
export const FSRS_WEIGHT_BOUNDS: ReadonlyArray<readonly [number, number]> = [
  [FSRS_MIN_STABILITY, FSRS_MAX_INITIAL_STABILITY], // w0  initial stability, Again
  [FSRS_MIN_STABILITY, FSRS_MAX_INITIAL_STABILITY], // w1  initial stability, Hard
  [FSRS_MIN_STABILITY, FSRS_MAX_INITIAL_STABILITY], // w2  initial stability, Good
  [FSRS_MIN_STABILITY, FSRS_MAX_INITIAL_STABILITY], // w3  initial stability, Easy
  [1, 10], // w4  initial difficulty base
  [0.001, 4], // w5  initial difficulty curve
  [0.001, 4], // w6  difficulty delta per grade
  [0.001, 0.75], // w7  mean reversion strength
  [0, 4.5], // w8  recall stability scale
  [0, 0.8], // w9  stability saturation
  [0.001, 3.5], // w10 retrievability sensitivity
  [0.001, 5], // w11 lapse stability scale
  [0.001, 0.25], // w12 lapse difficulty exponent
  [0.001, 0.9], // w13 lapse stability exponent
  [0, 4], // w14 lapse retrievability sensitivity
  [0, 1], // w15 hard penalty — must stay at or below 1, or Hard rewards you
  [1, 6], // w16 easy bonus — must stay at or above 1, or Easy punishes you
  [0, 2], // w17 short-term scale
  [0, 2], // w18 short-term offset
  [0, 0.8], // w19 short-term stability saturation
  [0.1, 0.8], // w20 forgetting-curve decay
];

/**
 * Validate an FSRS configuration, throwing on anything that would schedule
 * incorrectly rather than silently producing plausible-looking nonsense.
 *
 * The weight-count check matters more than it looks. Before migration existed,
 * every formula read its weights as `weights[n] ?? <default>`, so a 17-weight
 * FSRS-4.5 array was accepted without complaint and quietly mixed two
 * parameter sets — producing a scheduler that was neither algorithm and
 * matched no published behaviour. Nothing about the output looked wrong, which
 * is precisely the problem. Now a short vector is *migrated* rather than
 * padded, and an unrecognised length is an error.
 */
export function validateFSRSConfig(config: FSRSConfig): void {
  const { weights, desiredRetention, maximumIntervalDays, minimumIntervalDays } = config;

  const bad = weights.findIndex((w) => !Number.isFinite(w));
  if (bad !== -1) {
    throw new RangeError(`FSRS weight at index ${bad} is not a finite number.`);
  }

  // Throws on an unrecognised length, with a message naming the valid ones.
  const migrated = migrateWeights(weights);

  const outOfBounds = migrated.findIndex((w, i) => {
    const bound = FSRS_WEIGHT_BOUNDS[i];
    return bound !== undefined && (w < bound[0] || w > bound[1]);
  });
  if (outOfBounds !== -1) {
    const bound = FSRS_WEIGHT_BOUNDS[outOfBounds] as readonly [number, number];
    throw new RangeError(
      `FSRS weight w${outOfBounds} = ${migrated[outOfBounds]} is outside its valid ` +
        `range [${bound[0]}, ${bound[1]}]. Weights outside these bounds do not ` +
        'describe a memory model — check the vector against FSRS_6_DEFAULT_WEIGHTS.',
    );
  }

  if (!(desiredRetention > 0.5 && desiredRetention < 1)) {
    throw new RangeError(
      `desiredRetention must be between 0.5 and 1 (exclusive), received ${desiredRetention}. ` +
        'Typical values are 0.85-0.95; 0.9 is the default.',
    );
  }

  if (!(maximumIntervalDays >= 1)) {
    throw new RangeError(`maximumIntervalDays must be at least 1, received ${maximumIntervalDays}.`);
  }

  if (!(minimumIntervalDays > 0) || minimumIntervalDays > maximumIntervalDays) {
    throw new RangeError(
      `minimumIntervalDays must be greater than 0 and no larger than maximumIntervalDays, ` +
        `received ${minimumIntervalDays}.`,
    );
  }

  if (config.dayStartsAtHour < 0 || config.dayStartsAtHour > 23) {
    throw new RangeError(
      `dayStartsAtHour must be 0-23, received ${config.dayStartsAtHour}.`,
    );
  }

  if (config.learningStepsMinutes.some((m) => !(m > 0))) {
    throw new RangeError('Every learning step must be a positive number of minutes.');
  }

  if (config.relearningStepsMinutes.some((m) => !(m > 0))) {
    throw new RangeError('Every relearning step must be a positive number of minutes.');
  }
}
