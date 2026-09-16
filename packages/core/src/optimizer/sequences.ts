/**
 * Turning review logs into training data.
 *
 * The optimiser cannot use the `previous`/`next` snapshots stored on a
 * `ReviewLog` — those were computed with whatever weights were active at the
 * time, so training on them would just teach the model to reproduce its own
 * past mistakes. What it needs is the raw observable history: for each card, in
 * order, what the learner was asked, how long it had been, and whether they
 * recalled it.
 *
 * That is exactly what a log records, and the reason review history has to be
 * append-only. Delete it and no amount of future work recovers the ability to
 * fit the model to this learner.
 */

import type { ReviewLog, Timestamp } from '../types/index';
import { DAY_MS } from '../utils/date';
import { toFSRSRating } from '../algorithm/fsrs';
import type { FSRSRating } from '../algorithm/fsrs-params';

/** One observed review, stripped to what the model can learn from. */
export interface TrainingReview {
  rating: FSRSRating;
  /** Days since the previous review of this card. 0 for the first. */
  elapsedDays: number;
  /** True when the learner recalled it — the label being predicted. */
  passed: boolean;
  reviewedAt: Timestamp;
}

/** One card's history, oldest first. */
export type TrainingSequence = TrainingReview[];

export interface BuildSequencesOptions {
  /**
   * Drop reviews closer together than this, in days. Default 0 (keep all).
   *
   * Same-day repeats carry almost no spacing information but are numerous, so
   * they can dominate the loss and drag the fit toward short intervals.
   */
  minElapsedDays?: number;
  /** Ignore cards with fewer than this many reviews. Default 2. */
  minReviewsPerCard?: number;
}

/**
 * Group logs into per-card sequences with elapsed times computed.
 *
 * Cards with a single review are dropped by default: the first review of a card
 * has no prior state to predict from, so it contributes nothing to the loss.
 */
export function buildTrainingSequences(
  logs: readonly ReviewLog[],
  { minElapsedDays = 0, minReviewsPerCard = 2 }: BuildSequencesOptions = {},
): TrainingSequence[] {
  const byCard = new Map<string, ReviewLog[]>();

  for (const log of logs) {
    const existing = byCard.get(log.cardId);
    if (existing) existing.push(log);
    else byCard.set(log.cardId, [log]);
  }

  const sequences: TrainingSequence[] = [];

  for (const cardLogs of byCard.values()) {
    const ordered = [...cardLogs].sort((a, b) => a.reviewedAt - b.reviewedAt);

    const sequence: TrainingSequence = [];
    let previousAt: Timestamp | null = null;

    for (const log of ordered) {
      const elapsedDays =
        previousAt === null ? 0 : Math.max(0, (log.reviewedAt - previousAt) / DAY_MS);

      // Skip repeats that are too close to be informative, but keep the clock
      // running — the next real review's gap is measured from the last review
      // the learner actually did, not from the last one we kept.
      if (previousAt !== null && elapsedDays < minElapsedDays) {
        previousAt = log.reviewedAt;
        continue;
      }

      const rating = toFSRSRating(log.quality);
      sequence.push({
        rating,
        elapsedDays,
        passed: rating > 1,
        reviewedAt: log.reviewedAt,
      });
      previousAt = log.reviewedAt;
    }

    if (sequence.length >= minReviewsPerCard) sequences.push(sequence);
  }

  return sequences;
}

/** How many reviews in these sequences actually contribute to the loss. */
export function countPredictableReviews(sequences: readonly TrainingSequence[]): number {
  // The first review of each card has no prior memory state, so nothing to
  // predict from. Only the rest are scorable.
  let total = 0;
  for (const sequence of sequences) total += Math.max(0, sequence.length - 1);
  return total;
}

/**
 * Split sequences into train and validation sets, by card.
 *
 * Splitting by card rather than by review matters: reviews of the same card are
 * strongly dependent, so scattering them across both sets lets the model see
 * part of a card's history during training and be scored on the rest. That
 * inflates the validation score and hides overfitting, which is the one thing
 * validation exists to catch.
 */
export function splitSequences(
  sequences: readonly TrainingSequence[],
  validationFraction: number,
  random: () => number = Math.random,
): { train: TrainingSequence[]; validation: TrainingSequence[] } {
  if (validationFraction <= 0) return { train: [...sequences], validation: [] };

  const shuffled = [...sequences];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = shuffled[i];
    const b = shuffled[j];
    if (a !== undefined && b !== undefined) {
      shuffled[i] = b;
      shuffled[j] = a;
    }
  }

  const cut = Math.floor(shuffled.length * (1 - validationFraction));
  return { train: shuffled.slice(0, cut), validation: shuffled.slice(cut) };
}
