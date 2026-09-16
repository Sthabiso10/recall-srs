/**
 * Fitting FSRS weights to one learner's review history.
 *
 * This is the argument for FSRS over SM-2. The default weights are a
 * population average; the same nineteen numbers fitted to *your* learners
 * describe how *they* forget. Intervals get longer where they can afford to be
 * and shorter where they cannot, at the same retention target.
 *
 * ── How it works ────────────────────────────────────────────────────────
 *
 * 1. Replay each card's history under a candidate weight set, predicting the
 *    recall probability before each review.
 * 2. Score the predictions against what actually happened (log loss).
 * 3. Walk the weights downhill and repeat.
 *
 * Gradients are computed by central finite differences rather than autodiff.
 * With nineteen parameters that costs 38 passes over the data per step, which
 * is slower than the Rust reference implementation by a wide margin — but it is
 * exact to the precision that matters here, needs no dependencies, and runs in
 * any JavaScript runtime. For the dataset sizes this sees (thousands to tens of
 * thousands of reviews, optimised occasionally rather than continuously) that
 * trade is the right way round.
 *
 * ── When not to run it ──────────────────────────────────────────────────
 *
 * Fitting nineteen parameters to a few hundred reviews overfits: it will find
 * weights that describe the history superbly and predict the future worse than
 * the defaults did. The optimiser refuses below `minReviews`, holds out a
 * validation set it never trains on, and tells you plainly when the result is
 * not worth adopting. Getting a "keep the defaults" answer back is a successful
 * run, not a failed one.
 */

import type { FSRSConfig } from '../algorithm/fsrs-params';
import { DEFAULT_FSRS_CONFIG, FSRS_5_WEIGHT_COUNT } from '../algorithm/fsrs-params';
import type { ReviewLog } from '../types/index';
import { clamp01, clampWeights, denormalizeWeights, normalizeWeights } from './bounds';
import { computeLogLoss, evaluateWeights, type EvaluationResult } from './loss';
import {
  buildTrainingSequences,
  countPredictableReviews,
  splitSequences,
  type TrainingSequence,
} from './sequences';

export interface OptimizeOptions {
  /** Starting point. Defaults to the FSRS-5 population weights. */
  initialWeights?: readonly number[];

  /**
   * Refuse to optimise below this many scorable reviews. Default 400.
   *
   * Below roughly this much history the fit is dominated by noise and the
   * defaults genuinely are better. The number is a judgement call, not a
   * theorem — raise it if your learners have unusual review patterns.
   */
  minReviews?: number;

  /** Gradient steps. Default 60. */
  iterations?: number;

  /** Adam step size. Default 0.05. */
  learningRate?: number;

  /**
   * Share of cards held out to measure whether the fit generalises.
   * Default 0.2. Set to 0 to train on everything (not recommended).
   */
  validationFraction?: number;

  /**
   * Relative improvement in validation loss required before the result is
   * recommended. Default 0.01 — a 1% gain that is probably real, rather than a
   * 0.1% gain that is probably noise.
   */
  minImprovement?: number;

  /** Stop early when successive iterations improve less than this. Default 1e-5. */
  tolerance?: number;

  /** Reproducible train/validation splits. */
  random?: () => number;

  /** Progress callback, invoked once per iteration. */
  onProgress?: (progress: OptimizeProgress) => void;

  /** Abort a long run. Checked once per iteration. */
  signal?: { aborted: boolean };
}

export interface OptimizeProgress {
  iteration: number;
  totalIterations: number;
  trainLoss: number;
  weights: number[];
}

export interface OptimizeResult {
  /** Fitted weights, clamped into valid ranges. */
  weights: number[];

  /** Whether adopting these is actually advisable. */
  recommendation: 'adopt' | 'keep-defaults';
  /** Plain-language explanation, safe to show a user. */
  reason: string;

  /** Score of the starting weights on held-out data. */
  before: EvaluationResult;
  /** Score of the fitted weights on held-out data. */
  after: EvaluationResult;
  /** Relative reduction in validation log loss. Negative means it got worse. */
  improvement: number;

  iterations: number;
  /** True when it stopped on tolerance rather than exhausting iterations. */
  converged: boolean;
  /** Total scorable reviews used. */
  reviewCount: number;
  trainCardCount: number;
  validationCardCount: number;
}

/**
 * Fit weights to a learner's review history.
 *
 * Async and yields to the event loop each iteration, so it can run in a browser
 * tab without freezing it — though a Web Worker is a better home for a job that
 * may take tens of seconds.
 *
 *   const result = await optimizeFSRSWeights(await adapter.listReviews());
 *   if (result.recommendation === 'adopt') {
 *     const scheduler = createFSRSScheduler({ weights: result.weights });
 *   }
 */
export async function optimizeFSRSWeights(
  logs: readonly ReviewLog[],
  options: OptimizeOptions = {},
): Promise<OptimizeResult> {
  const {
    initialWeights = DEFAULT_FSRS_CONFIG.weights,
    minReviews = 400,
    iterations = 60,
    learningRate = 0.05,
    validationFraction = 0.2,
    minImprovement = 0.01,
    tolerance = 1e-5,
    random = Math.random,
    onProgress,
    signal,
  } = options;

  if (initialWeights.length !== FSRS_5_WEIGHT_COUNT) {
    throw new RangeError(
      `initialWeights must have ${FSRS_5_WEIGHT_COUNT} entries, received ${initialWeights.length}.`,
    );
  }

  const sequences = buildTrainingSequences(logs);
  const reviewCount = countPredictableReviews(sequences);

  const { train, validation } = splitSequences(sequences, validationFraction, random);
  const scoreSet = validation.length > 0 ? validation : train;

  const startWeights = clampWeights(initialWeights);
  const before = evaluateWeights(scoreSet, withWeights(startWeights));

  // Too little history: say so and stop, rather than returning overfitted
  // weights that look like an improvement and are not.
  if (reviewCount < minReviews) {
    return {
      weights: [...startWeights],
      recommendation: 'keep-defaults',
      reason:
        `Not enough review history to fit ${FSRS_5_WEIGHT_COUNT} parameters: ` +
        `${reviewCount} scorable reviews, ${minReviews} needed. The default weights will ` +
        'schedule better than anything fitted to this much data. Come back after a few ' +
        'hundred more reviews.',
      before,
      after: before,
      improvement: 0,
      iterations: 0,
      converged: false,
      reviewCount,
      trainCardCount: train.length,
      validationCardCount: validation.length,
    };
  }

  /* ---- Adam, in normalised coordinates --------------------------------- */

  // Every parameter becomes a fraction of its own valid range, so one learning
  // rate means the same thing for all nineteen. Without this the optimiser
  // cannot move the large weights and destroys the small ones — the fit came
  // out slightly worse than the defaults it started from.
  let best = normalizeWeights(startWeights);
  let bestLoss = computeLogLoss(train, withWeights(denormalizeWeights(best)));

  const m = new Array<number>(best.length).fill(0);
  const v = new Array<number>(best.length).fill(0);
  const beta1 = 0.9;
  const beta2 = 0.999;
  const eps = 1e-8;

  let step = learningRate;
  let converged = false;
  let completed = 0;
  let adamStep = 0;

  for (let iteration = 1; iteration <= iterations; iteration++) {
    if (signal?.aborted) break;
    // A step too small to change anything means we are done.
    if (step < learningRate / 64) {
      converged = true;
      break;
    }

    const gradient = normalizedGradient(train, best);
    adamStep += 1;

    const candidate = [...best];
    for (let i = 0; i < candidate.length; i++) {
      const g = gradient[i] ?? 0;
      m[i] = beta1 * (m[i] ?? 0) + (1 - beta1) * g;
      v[i] = beta2 * (v[i] ?? 0) + (1 - beta2) * g * g;

      // Bias correction: without it the first several steps are far too small,
      // which on a short iteration budget is most of the run.
      const mHat = (m[i] ?? 0) / (1 - beta1 ** adamStep);
      const vHat = (v[i] ?? 0) / (1 - beta2 ** adamStep);

      candidate[i] = clamp01((candidate[i] ?? 0) - (step * mHat) / (Math.sqrt(vHat) + eps));
    }

    const loss = computeLogLoss(train, withWeights(denormalizeWeights(candidate)));
    completed = iteration;

    /**
     * Backtracking line search.
     *
     * Adam normalises each parameter's step to roughly the learning rate
     * regardless of gradient magnitude, so a weight whose gradient is pure
     * noise moves exactly as far as one carrying real signal. Taking all
     * nineteen of those steps at once routinely lands somewhere worse than
     * where it started — measured, not theorised: the first step raised
     * training loss from 0.1123 to 0.1181 and the run then oscillated without
     * ever recovering.
     *
     * Accepting only steps that actually reduce the loss, and halving the step
     * size when one does not, makes progress monotone. It costs extra loss
     * evaluations on rejected steps and is worth every one of them.
     */
    if (loss < bestLoss) {
      best = candidate;
      bestLoss = loss;
      if (Math.abs(bestLoss - loss) < tolerance) converged = true;
    } else {
      step /= 2;
    }

    onProgress?.({
      iteration,
      totalIterations: iterations,
      trainLoss: bestLoss,
      weights: denormalizeWeights(best),
    });

    // Hand the event loop back so a browser tab stays responsive.
    await Promise.resolve();
  }

  const weights = clampWeights(denormalizeWeights(best));

  /* ---- verdict --------------------------------------------------------- */

  const after = evaluateWeights(scoreSet, withWeights(weights));
  const improvement =
    Number.isFinite(before.logLoss) && before.logLoss > 0
      ? (before.logLoss - after.logLoss) / before.logLoss
      : 0;

  const helped = improvement >= minImprovement;
  const measuredOn = validation.length > 0 ? 'held-out' : 'training';

  return {
    weights: helped ? [...weights] : [...startWeights],
    recommendation: helped ? 'adopt' : 'keep-defaults',
    reason: helped
      ? `Fitted weights predict this learner ${(improvement * 100).toFixed(1)}% better than ` +
        `the starting weights on ${measuredOn} data (${reviewCount} reviews). ` +
        `Calibration error fell from ${before.rmse.toFixed(4)} to ${after.rmse.toFixed(4)}.`
      : `Fitting produced no meaningful gain (${(improvement * 100).toFixed(1)}% on ` +
        `${measuredOn} data, ${(minImprovement * 100).toFixed(0)}% required), so the starting ` +
        'weights are returned unchanged. This is a normal outcome when history is thin or ' +
        'the defaults already describe this learner well.',
    before,
    after,
    improvement,
    iterations: completed,
    converged,
    reviewCount,
    trainCardCount: train.length,
    validationCardCount: validation.length,
  };
}

/**
 * Central finite-difference gradient of the log loss, in normalised space.
 *
 * Central rather than forward differences: it costs twice as much per parameter
 * but the error falls with the square of the step instead of linearly, and this
 * loss surface is flat enough in places that forward differences round to zero
 * and the parameter simply never moves.
 *
 * The step is a fixed fraction of the normalised range, which is the point of
 * normalising — probing w7 and w3 by "1% of what this weight could be" is
 * meaningful for both, where a fixed absolute step is meaningful for neither.
 */
function normalizedGradient(
  sequences: readonly TrainingSequence[],
  normalized: readonly number[],
): number[] {
  const gradient = new Array<number>(normalized.length).fill(0);
  const h = 0.01;

  for (let i = 0; i < normalized.length; i++) {
    const z = normalized[i] ?? 0;

    const up = [...normalized];
    up[i] = Math.min(1, z + h);
    const down = [...normalized];
    down[i] = Math.max(0, z - h);

    // The span actually probed, which shrinks at the boundaries.
    const span = (up[i] ?? 0) - (down[i] ?? 0);
    if (span === 0) continue;

    const lossUp = computeLogLoss(sequences, withWeights(denormalizeWeights(up)));
    const lossDown = computeLogLoss(sequences, withWeights(denormalizeWeights(down)));

    const g = (lossUp - lossDown) / span;
    gradient[i] = Number.isFinite(g) ? g : 0;
  }

  return gradient;
}


/** A config that differs from the defaults only in its weights. */
function withWeights(weights: readonly number[]): FSRSConfig {
  return { ...DEFAULT_FSRS_CONFIG, weights };
}
