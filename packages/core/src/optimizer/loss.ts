/**
 * How good is a set of weights?
 *
 * The model predicts, before each review, the probability that the learner will
 * recall the card. The outcome is observed. Scoring those predictions against
 * those outcomes is the whole of the objective — everything the optimiser does
 * is search for weights that score better.
 *
 * Two metrics, and they answer different questions:
 *
 *   log loss  — what gradient descent minimises. Punishes confident mistakes
 *               hard, which is the right shape for fitting.
 *   RMSE      — what the FSRS community reports. Bins predictions and compares
 *               each bin's predicted rate to its observed rate, so it measures
 *               *calibration*: when the model says 90%, does 90% happen?
 *
 * A model can have decent log loss and poor calibration, and calibration is
 * what a learner actually feels — `desiredRetention: 0.9` is a promise that
 * only means something if the model is calibrated.
 */

import type { FSRSConfig } from '../algorithm/fsrs-params';
import { applyFSRS, retrievability } from '../algorithm/fsrs';
import type { TrainingSequence } from './sequences';

/** Probabilities are clamped away from 0 and 1 so log loss stays finite. */
const EPSILON = 1e-6;

export interface EvaluationResult {
  /** Mean binary cross-entropy. Lower is better. */
  logLoss: number;
  /** Calibration error over probability bins, 0-1. Lower is better. */
  rmse: number;
  /** Share of outcomes predicted correctly at a 0.5 threshold. */
  accuracy: number;
  /** How many reviews were scorable — first reviews of a card are not. */
  reviewCount: number;
}

/**
 * Score a weight set against observed history.
 *
 * Replays each card's sequence with the given weights, predicting before each
 * review and then folding the outcome in — the same loop the scheduler runs in
 * production, which is what makes the score meaningful.
 */
export function evaluateWeights(
  sequences: readonly TrainingSequence[],
  config: FSRSConfig,
): EvaluationResult {
  let lossSum = 0;
  let correct = 0;
  let count = 0;

  // Ten calibration bins: [0, 0.1), [0.1, 0.2) ... [0.9, 1].
  const binPredicted = new Array<number>(10).fill(0);
  const binObserved = new Array<number>(10).fill(0);
  const binCount = new Array<number>(10).fill(0);

  for (const sequence of sequences) {
    let memory = null as ReturnType<typeof applyFSRS> | null;

    for (const review of sequence) {
      if (memory !== null) {
        const predicted = clamp(
          retrievability(review.elapsedDays, memory.stability, config.weights),
          EPSILON,
          1 - EPSILON,
        );
        const observed = review.passed ? 1 : 0;

        lossSum += -(observed * Math.log(predicted) + (1 - observed) * Math.log(1 - predicted));
        if (predicted >= 0.5 === review.passed) correct += 1;

        const bin = Math.min(9, Math.max(0, Math.floor(predicted * 10)));
        binPredicted[bin] = (binPredicted[bin] ?? 0) + predicted;
        binObserved[bin] = (binObserved[bin] ?? 0) + observed;
        binCount[bin] = (binCount[bin] ?? 0) + 1;

        count += 1;
      }

      memory = applyFSRS(memory, review.rating, review.elapsedDays, config);
    }
  }

  if (count === 0) {
    return { logLoss: Number.POSITIVE_INFINITY, rmse: 1, accuracy: 0, reviewCount: 0 };
  }

  // Weight each bin by how many reviews landed in it, so a bin holding three
  // reviews cannot swing the number as much as one holding three thousand.
  let weightedSquaredError = 0;
  for (let i = 0; i < 10; i++) {
    const n = binCount[i] ?? 0;
    if (n === 0) continue;
    const meanPredicted = (binPredicted[i] ?? 0) / n;
    const meanObserved = (binObserved[i] ?? 0) / n;
    weightedSquaredError += n * (meanPredicted - meanObserved) ** 2;
  }

  return {
    logLoss: lossSum / count,
    rmse: Math.sqrt(weightedSquaredError / count),
    accuracy: correct / count,
    reviewCount: count,
  };
}

/** Just the log loss — the optimiser's objective, called in the inner loop. */
export function computeLogLoss(
  sequences: readonly TrainingSequence[],
  config: FSRSConfig,
): number {
  let lossSum = 0;
  let count = 0;

  for (const sequence of sequences) {
    let memory = null as ReturnType<typeof applyFSRS> | null;

    for (const review of sequence) {
      if (memory !== null) {
        const predicted = clamp(
          retrievability(review.elapsedDays, memory.stability, config.weights),
          EPSILON,
          1 - EPSILON,
        );
        lossSum += review.passed ? -Math.log(predicted) : -Math.log(1 - predicted);
        count += 1;
      }
      memory = applyFSRS(memory, review.rating, review.elapsedDays, config);
    }
  }

  return count === 0 ? Number.POSITIVE_INFINITY : lossSum / count;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
