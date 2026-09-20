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
 * The table itself lives in `algorithm/fsrs-params` and is re-exported here.
 * It used to be a second, hand-written copy — which is exactly the arrangement
 * where one of the two drifts and nothing notices, because a wrong bound
 * silently caps a parameter at the wrong place and the only symptom is a fit
 * that stops improving early. There is now one table, verified against
 * `open-spaced-repetition/ts-fsrs` (`CLAMP_PARAMETERS`) and
 * `open-spaced-repetition/py-fsrs` (`LOWER_BOUNDS_PARAMETERS` /
 * `UPPER_BOUNDS_PARAMETERS`), which agree entry for entry.
 */

import { FSRS_WEIGHT_BOUNDS } from '../algorithm/fsrs-params';

/** `[min, max]` per weight index, covering FSRS-6's 21 parameters. */
export { FSRS_WEIGHT_BOUNDS };

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
 * The weights span four orders of magnitude — w7 sits near 0.001 while w3 sits
 * near 8. Gradient descent with a single step size cannot serve both: a step
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
