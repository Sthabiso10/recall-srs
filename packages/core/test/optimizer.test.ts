/**
 * The optimiser.
 *
 * The headline test is weight recovery: generate review history from a known
 * weight set, then check the optimiser fits something that predicts held-out
 * data better than the defaults do. That is the only test that really shows
 * the thing works — loss going down on training data proves nothing, since
 * enough parameters will fit any noise.
 */

import {
  DEFAULT_FSRS_CONFIG,
  applyFSRS,
  retrievability,
  toFSRSRating,
} from '../src/index';
import type { ReviewLog } from '../src/index';
import {
  FSRS_WEIGHT_BOUNDS,
  buildTrainingSequences,
  clampWeights,
  countPredictableReviews,
  evaluateWeights,
  optimizeFSRSWeights,
  splitSequences,
  weightsInBounds,
} from '../src/optimizer/index';

const DAY = 86_400_000;
const START = Date.parse('2026-01-01T09:00:00.000Z');

/** Deterministic PRNG, so a failing run is reproducible. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/**
 * Simulate a learner whose memory really does follow FSRS with `trueWeights`.
 *
 * Two details make this a fair test rather than a flattering one.
 *
 * **Reviews land on a fixed cadence**, not on the interval the true model would
 * choose. If the generating model also picked when reviews happened, the data
 * would be self-consistent under any weights — the schedule would hide the
 * difference it was supposed to expose — and the defaults would score as well
 * as the truth. Measured: with adaptive scheduling the gap between default and
 * true weights was 0.6%; with a fixed cadence it is 12%.
 *
 * **Outcomes are sampled** from the true recall probability rather than
 * thresholded, so the data carries honest noise and the optimiser has to find
 * signal rather than memorise a deterministic rule.
 */
function simulateHistory(
  trueWeights: readonly number[],
  { cards = 200, reviewsPerCard = 14, seed = 11 } = {},
): ReviewLog[] {
  const random = seeded(seed);
  const config = { ...DEFAULT_FSRS_CONFIG, weights: trueWeights };
  const logs: ReviewLog[] = [];

  for (let c = 0; c < cards; c++) {
    let memory: ReturnType<typeof applyFSRS> | null = null;
    let at = START + c * 1000;
    let lastAt: number | null = null;

    for (let r = 0; r < reviewsPerCard; r++) {
      const elapsedDays = lastAt === null ? 0 : Math.max(0, (at - lastAt) / DAY);

      let rating: 1 | 2 | 3 | 4;
      let passed = true;

      if (memory === null) {
        const roll = random();
        rating = roll < 0.15 ? 2 : roll < 0.85 ? 3 : 4;
      } else {
        passed = random() < retrievability(elapsedDays, memory.stability);
        rating = passed ? (random() < 0.2 ? 4 : 3) : 1;
      }

      logs.push({
        id: `r${c}_${r}`,
        cardId: `card${c}`,
        quality: ({ 1: 1, 2: 3, 3: 4, 4: 5 } as const)[rating],
        reviewedAt: at,
        durationMs: 2000,
        previous: { repetitions: r, easeFactor: 2.5, interval: 0, status: 'review' },
        next: { repetitions: r + 1, easeFactor: 2.5, interval: 0, status: 'review' },
        lapsed: !passed,
      });

      memory = applyFSRS(memory, rating, elapsedDays, config);
      lastAt = at;
      at += Math.round((2 + random() * 20) * DAY);
    }
  }

  return logs;
}

/**
 * Weights describing a learner whose memories strengthen far faster than the
 * population average — changes to w8/w9/w10 affect every review, unlike the
 * initial-stability weights which only touch a card's first sighting.
 */
const DISTINCTIVE_LEARNER = (() => {
  const w = [...DEFAULT_FSRS_CONFIG.weights];
  w[8] = 3.2;
  w[9] = 0.5;
  w[10] = 2.4;
  return w;
})();

describe('training data', () => {
  it('groups logs into per-card sequences with elapsed times', () => {
    const logs = simulateHistory(DEFAULT_FSRS_CONFIG.weights, { cards: 3, reviewsPerCard: 4 });
    const sequences = buildTrainingSequences(logs);

    expect(sequences).toHaveLength(3);
    expect(sequences[0]).toHaveLength(4);
    expect(sequences[0]![0]!.elapsedDays).toBe(0);
    expect(sequences[0]![1]!.elapsedDays).toBeGreaterThan(0);
  });

  it('drops single-review cards, which cannot be predicted from', () => {
    const logs = simulateHistory(DEFAULT_FSRS_CONFIG.weights, { cards: 2, reviewsPerCard: 1 });
    expect(buildTrainingSequences(logs)).toHaveLength(0);
  });

  it('counts only scorable reviews', () => {
    const logs = simulateHistory(DEFAULT_FSRS_CONFIG.weights, { cards: 5, reviewsPerCard: 4 });
    // Five cards × four reviews, minus the first of each = 15.
    expect(countPredictableReviews(buildTrainingSequences(logs))).toBe(15);
  });

  it('splits by card, never scattering one card across both sets', () => {
    const logs = simulateHistory(DEFAULT_FSRS_CONFIG.weights, { cards: 20, reviewsPerCard: 5 });
    const sequences = buildTrainingSequences(logs);
    const { train, validation } = splitSequences(sequences, 0.25, seeded(1));

    expect(train.length + validation.length).toBe(sequences.length);
    expect(validation.length).toBeGreaterThan(0);
  });
});

describe('evaluation', () => {
  it('scores a weight set on log loss, calibration and accuracy', () => {
    const logs = simulateHistory(DEFAULT_FSRS_CONFIG.weights, { cards: 30, reviewsPerCard: 8 });
    const result = evaluateWeights(buildTrainingSequences(logs), DEFAULT_FSRS_CONFIG);

    expect(result.reviewCount).toBeGreaterThan(100);
    expect(result.logLoss).toBeGreaterThan(0);
    expect(result.logLoss).toBeLessThan(2);
    expect(result.rmse).toBeGreaterThanOrEqual(0);
    expect(result.accuracy).toBeGreaterThan(0.5);
  });

  it('scores deliberately wrong weights worse than the right ones', () => {
    const logs = simulateHistory(DEFAULT_FSRS_CONFIG.weights, { cards: 40, reviewsPerCard: 8 });
    const sequences = buildTrainingSequences(logs);

    // Absurdly high initial stability: the model expects everything to be
    // remembered forever, so it is confidently wrong about every lapse.
    const wrong = [...DEFAULT_FSRS_CONFIG.weights];
    wrong[0] = 90;
    wrong[1] = 90;
    wrong[2] = 90;
    wrong[3] = 90;

    const good = evaluateWeights(sequences, DEFAULT_FSRS_CONFIG);
    const bad = evaluateWeights(sequences, { ...DEFAULT_FSRS_CONFIG, weights: wrong });

    expect(bad.logLoss).toBeGreaterThan(good.logLoss);
  });
});

describe('bounds', () => {
  it('has one range per FSRS-5 weight', () => {
    expect(FSRS_WEIGHT_BOUNDS).toHaveLength(19);
  });

  it('clamps out-of-range and non-finite values', () => {
    const clamped = clampWeights([-5, ...DEFAULT_FSRS_CONFIG.weights.slice(1, 18), Number.NaN]);
    expect(weightsInBounds(clamped)).toBe(true);
  });

  it('keeps the hard penalty at or below 1 and the easy bonus at or above 1', () => {
    // Otherwise Hard lengthens intervals and Easy shortens them — the model
    // would be rewarding the wrong answers.
    const clamped = clampWeights(DEFAULT_FSRS_CONFIG.weights.map(() => 99));
    expect(clamped[15]).toBeLessThanOrEqual(1);
    expect(clamped[16]).toBeGreaterThanOrEqual(1);
  });
});

describe('optimizeFSRSWeights', () => {
  it('refuses to fit when history is too thin, and says why', async () => {
    const logs = simulateHistory(DEFAULT_FSRS_CONFIG.weights, { cards: 4, reviewsPerCard: 4 });
    const result = await optimizeFSRSWeights(logs, { random: seeded(3) });

    expect(result.recommendation).toBe('keep-defaults');
    expect(result.reason).toMatch(/Not enough review history/);
    // Returning the input unchanged means a caller can adopt the result
    // unconditionally without checking.
    expect(result.weights).toEqual(clampWeights(DEFAULT_FSRS_CONFIG.weights));
    expect(result.iterations).toBe(0);
  });

  it('recovers a better fit for a learner who is not the population average', async () => {
    const logs = simulateHistory(DISTINCTIVE_LEARNER);
    const result = await optimizeFSRSWeights(logs, { iterations: 40, random: seeded(5) });

    expect(result.reviewCount).toBeGreaterThan(400);
    expect(weightsInBounds(result.weights)).toBe(true);

    // The bar that matters: better predictions on cards it never trained on.
    expect(result.after.logLoss).toBeLessThan(result.before.logLoss);
    expect(result.improvement).toBeGreaterThan(0.02);
    expect(result.recommendation).toBe('adopt');
  }, 120_000);

  it('moves the weights that carry the signal toward the truth', async () => {
    const logs = simulateHistory(DISTINCTIVE_LEARNER);
    const result = await optimizeFSRSWeights(logs, { iterations: 40, random: seeded(5) });

    // It will not arrive exactly — 19 parameters, finite data, finite steps —
    // but w8 and w10 should both have moved up, toward the true values.
    const defaults = DEFAULT_FSRS_CONFIG.weights;
    expect(result.weights[8]!).toBeGreaterThan(defaults[8]!);
    expect(result.weights[10]!).toBeGreaterThan(defaults[10]!);
  }, 120_000);

  it('never returns a fit worse than where it started', async () => {
    // Backtracking guarantees this: steps that raise the loss are rejected and
    // the step size halves. Before that, the first step routinely made things
    // worse and the run oscillated without recovering.
    const logs = simulateHistory(DISTINCTIVE_LEARNER, { cards: 120 });
    const result = await optimizeFSRSWeights(logs, { iterations: 15, random: seeded(4) });
    expect(result.improvement).toBeGreaterThanOrEqual(0);
  }, 120_000);

  it('reports progress and can be aborted', async () => {
    const logs = simulateHistory(DEFAULT_FSRS_CONFIG.weights, { cards: 60, reviewsPerCard: 10 });
    const seen: number[] = [];
    const signal = { aborted: false };

    await optimizeFSRSWeights(logs, {
      iterations: 50,
      random: seeded(2),
      onProgress: ({ iteration, trainLoss }) => {
        seen.push(trainLoss);
        if (iteration >= 3) signal.aborted = true;
      },
      signal,
    });

    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(seen.length).toBeLessThan(10);
  }, 120_000);

  it('returns the starting weights when fitting does not help', async () => {
    // Data generated from the defaults: there is nothing for the optimiser to
    // find, and it should say so rather than inventing an improvement.
    const logs = simulateHistory(DEFAULT_FSRS_CONFIG.weights, {
      cards: 70,
      reviewsPerCard: 10,
      seed: 21,
    });
    const result = await optimizeFSRSWeights(logs, {
      iterations: 8,
      minImprovement: 0.25, // demand an implausible gain
      random: seeded(9),
    });

    expect(result.recommendation).toBe('keep-defaults');
    expect(result.weights).toEqual(clampWeights(DEFAULT_FSRS_CONFIG.weights));
    expect(result.reason).toMatch(/no meaningful gain/);
  }, 120_000);

  it('rejects a weight vector of the wrong length', async () => {
    await expect(
      optimizeFSRSWeights([], { initialWeights: Array(17).fill(1) }),
    ).rejects.toThrow(/19/);
  });
});

describe('rating mapping round trip', () => {
  it('maps simulated qualities back to the ratings that produced them', () => {
    expect(toFSRSRating(1)).toBe(1);
    expect(toFSRSRating(3)).toBe(2);
    expect(toFSRSRating(4)).toBe(3);
    expect(toFSRSRating(5)).toBe(4);
  });
});
