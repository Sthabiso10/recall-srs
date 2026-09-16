/**
 * The scheduler — the public face of the algorithm.
 *
 * `sm2.ts` does timeless math on a `SchedulingState`. The scheduler wraps it
 * with the things a real app needs: a clock, due-date arithmetic, interval
 * fuzz, whole `Card` objects, and the `ReviewLog` entry that makes the review
 * auditable afterwards.
 *
 * Swapping in FSRS or a custom algorithm later means writing one more module
 * with this same surface — nothing above this layer touches `applySM2` directly.
 *
 *   const scheduler = createScheduler();
 *   const { card, log } = scheduler.grade(card, 4);
 *   await storage.saveCard(card);
 *   await storage.saveReview(log);
 */

import type {
  Card,
  RecallQuality,
  ReviewLog,
  SchedulingState,
  Timestamp,
} from '../types/index';
import type { Clock } from '../ports/clock';
import { systemClock } from '../ports/clock';
import { dueAtFor } from '../utils/date';
import { createId } from '../utils/id';
import type { SchedulerConfig } from './constants';
import { DEFAULT_SCHEDULER_CONFIG } from './constants';
import { NotImplementedError, SM2_IMPLEMENTED, applySM2 } from './sm2';
import type { GradeOptions, GradeResult, SchedulePreview, Scheduler } from './types';

// The contract now lives in ./types so FSRS can implement the same one.
// Re-exported here so existing `from '.../algorithm/scheduler'` imports keep working.
export type { GradeOptions, GradeResult, SchedulePreview, Scheduler } from './types';

export function createScheduler(
  options: Partial<SchedulerConfig> & { clock?: Clock; random?: () => number } = {},
): Scheduler<SchedulerConfig> {
  const { clock = systemClock, random = Math.random, ...overrides } = options;
  const config: SchedulerConfig = { ...DEFAULT_SCHEDULER_CONFIG, ...overrides };

  // Fail at construction, not deep inside a study session, and say what to do.
  if (!SM2_IMPLEMENTED) {
    throw new NotImplementedError(
      [
        'The SM-2 scheduler is not implemented yet and would schedule every card',
        'incorrectly (a fixed one-day interval, forever).',
        '',
        'Use createFSRSScheduler() instead — implemented, tested, and the better',
        'algorithm for new projects:',
        '',
        "    import { createFSRSScheduler } from '@recall-srs/core';",
        '    const scheduler = createFSRSScheduler({ desiredRetention: 0.9 });',
        '',
        'Track SM-2 support at https://github.com/Sthabiso10/recall-srs/issues',
      ].join('\n'),
    );
  }

  function initialState(now: Timestamp = clock.now()): SchedulingState {
    return {
      repetitions: 0,
      easeFactor: config.initialEaseFactor,
      interval: 0,
      // New cards are due immediately — they have nothing to forget yet.
      dueAt: now,
      lastReviewedAt: null,
      lapses: 0,
      status: 'new',
    };
  }

  function review(
    state: SchedulingState,
    quality: RecallQuality,
    now: Timestamp = clock.now(),
  ): SchedulingState {
    const next = applySM2(state, quality, config);
    return {
      ...next,
      dueAt: dueAtFor(
        now,
        applyFuzz(next.interval, config.intervalFuzzRatio, random),
        config.dayStartsAtHour,
      ),
      lastReviewedAt: now,
    };
  }

  function grade(
    card: Card,
    quality: RecallQuality,
    { now = clock.now(), durationMs = 0, sessionId }: GradeOptions = {},
  ): GradeResult {
    const before = card.scheduling;
    const after = review(before, quality, now);

    const log: ReviewLog = {
      id: createId('rev'),
      cardId: card.id,
      ...(sessionId ? { sessionId } : {}),
      quality,
      reviewedAt: now,
      durationMs,
      previous: snapshot(before),
      next: snapshot(after),
      lapsed: quality < config.passingQuality,
    };

    return {
      card: { ...card, scheduling: after, updatedAt: now },
      log,
    };
  }

  function isDue(
    card: Card,
    now: Timestamp = clock.now(),
    fuzzMs = 0,
  ): boolean {
    if (card.scheduling.status === 'suspended') return false;
    return card.scheduling.dueAt <= now + fuzzMs;
  }

  function preview(
    card: Card,
    now: Timestamp = clock.now(),
  ): Record<RecallQuality, SchedulePreview> {
    const qualities: RecallQuality[] = [0, 1, 2, 3, 4, 5];
    // Fuzz is deliberately skipped here: a preview must match what actually
    // happens closely enough that the button label is not a lie.
    const entries = qualities.map((quality) => {
      const next = applySM2(card.scheduling, quality, config);
      return [
        quality,
        {
          quality,
          intervalDays: next.interval,
          dueAt: dueAtFor(now, next.interval, config.dayStartsAtHour),
          lapses: quality < config.passingQuality,
        },
      ] as const;
    });
    return Object.fromEntries(entries) as Record<RecallQuality, SchedulePreview>;
  }

  return { algorithm: 'sm2', config, initialState, grade, review, isDue, preview };
}

/**
 * Previously a shared default SM-2 instance. Removed: it was constructed at
 * module load, so re-adding it now would throw on `import '@recall-srs/core'`.
 * Construct a scheduler explicitly instead — `createFSRSScheduler()`.
 */

function snapshot(state: SchedulingState) {
  return {
    repetitions: state.repetitions,
    easeFactor: state.easeFactor,
    interval: state.interval,
    status: state.status,
  };
}

/**
 * Spread due dates so cards introduced on the same day do not stay welded
 * together for years. Returns the interval unchanged when the ratio is 0.
 */
function applyFuzz(intervalDays: number, ratio: number, random: () => number): number {
  if (ratio <= 0 || intervalDays <= 1) return intervalDays;
  const spread = intervalDays * ratio;
  return intervalDays + (random() * 2 - 1) * spread;
}
