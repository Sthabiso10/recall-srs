/**
 * Parameter bounds for FSRS weights.
 *
 * Every weight has a range outside which the model stops describing memory and
 * starts describing noise — a negative initial stability, an ease multiplier
 * below 1, a difficulty that cannot move. Gradient descent will happily walk
 * into those regions if the data is thin or unusual, producing weights that fit
 * the history beautifully and schedule nonsense.
 *
 * Clamping after every step is the cheap defence. It is what makes the
 * optimiser safe to run on a learner with 500 reviews rather than 50,000.
 *
 * ⚠️ These ranges mirror the reference implementation's clamps but were written
 * by hand. Check them against `open-spaced-repetition/fsrs-rs` before relying on
 * the optimiser in production — a wrong bound silently caps a parameter at the
 * wrong place, and the only symptom is a fit that stops improving early.
 */

/** `[min, max]` per weight index, matching FSRS-5's 19 parameters. */
export const FSRS_WEIGHT_BOUNDS: ReadonlyArray<readonly [number, number]> = [
  [0.001, 100], // w0  initial stability, Again
  [0.001, 100], // w1  initial stability, Hard
  [0.001, 100], // w2  initial stability, Good
  [0.001, 100], // w3  initial stability, Easy
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
];

/** Clamp a weight vector into valid ranges. Returns a new array. */
export function clampWeights(weights: readonly number[]): number[] {
  return weights.map((w, i) => {
    const bound = FSRS_WEIGHT_BOUNDS[i];
    if (!bound) return w;
    const [min, max] = bound;
    if (!Number.isFinite(w)) return (min + max) / 2;
    return Math.min(Math.max(w, min), max);
  });
}

/** True when every weight sits inside its bound. */
export function weightsInBounds(weights: readonly number[]): boolean {
  return weights.every((w, i) => {
    const bound = FSRS_WEIGHT_BOUNDS[i];
    if (!bound) return true;
    return Number.isFinite(w) && w >= bound[0] && w <= bound[1];
  });
}

/**
 * Map weights into a normalised [0, 1] space, and back.
 *
 * The weights span four orders of magnitude — w7 sits near 0.005 while w3 sits
 * near 16. Gradient descent with a single step size cannot serve both: a step
 * large enough to move w3 anywhere useful obliterates w7, and a step small
 * enough to respect w7 leaves w3 essentially frozen.
 *
 * Optimising in normalised coordinates fixes this. Each parameter becomes a
 * fraction of its own valid range, so one learning rate means the same thing
 * for every weight — "move up to 5% of what this parameter could be".
 */
export function normalizeWeights(weights: readonly number[]): number[] {
  return weights.map((w, i) => {
    const bound = FSRS_WEIGHT_BOUNDS[i];
    if (!bound) return w;
    const [min, max] = bound;
    const span = max - min;
    return span === 0 ? 0 : clamp01((w - min) / span);
  });
}

/** Inverse of `normalizeWeights`. */
export function denormalizeWeights(normalized: readonly number[]): number[] {
  return normalized.map((z, i) => {
    const bound = FSRS_WEIGHT_BOUNDS[i];
    if (!bound) return z;
    const [min, max] = bound;
    return min + clamp01(z) * (max - min);
  });
}

/** Clamp into the normalised [0, 1] range, mapping non-finite values to the middle. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(Math.max(value, 0), 1);
}
