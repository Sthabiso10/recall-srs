/**
 * The FSRS scheduler.
 *
 * Implements exactly the same `Scheduler` interface as the SM-2 one, so
 * switching is a one-line change and requires no data migration — FSRS state
 * lives in `scheduling.memory`, which SM-2 simply ignores.
 *
 *   import { createFSRSScheduler } from '@recall-srs/core';
 *
 *   const scheduler = createFSRSScheduler({ desiredRetention: 0.9 });
 *   const { card, log } = scheduler.grade(card, 4);
 *
 * ── Migrating an existing SM-2 deck ─────────────────────────────────────
 *
 * Point the provider at this scheduler and every card keeps working. Cards
 * carry no `memory` until their next review, at which point FSRS seeds one
 * from that grade — so a migrated deck behaves like a fresh FSRS deck for one
 * round, then schedules normally.
 *
 * You can do better if you care: FSRS can reconstruct memory state by replaying
 * a card's `ReviewLog` history through `applyFSRS`. That is exactly why review
 * logs are append-only. Worth building as `reconstructMemory(logs)` once the
 * basics are in place.
 */

import type { Card, RecallQuality, ReviewLog, SchedulingState, Timestamp } from '../types/index';
import type { Clock } from '../ports/clock';
import { systemClock } from '../ports/clock';
import { DAY_MS } from '../utils/date';
import { createId } from '../utils/id';
import type { GradeOptions, GradeResult, SchedulePreview, Scheduler } from './types';
import type { FSRSConfig } from './fsrs-params';
import { DEFAULT_FSRS_CONFIG } from './fsrs-params';
import { applyFSRS, intervalForRetention, retrievability, toFSRSRating } from './fsrs';

export type FSRSScheduler = Scheduler<FSRSConfig> & {
  /**
   * Probability of recalling this card right now, 0-1.
   *
   * FSRS-only — SM-2 has no equivalent, which is the point. Use it to sort a
   * "most at risk of being forgotten" queue, or to show the learner why a card
   * came back today.
   */
  retrievabilityOf(card: Card, now?: Timestamp): number;
};

export function createFSRSScheduler(
  options: Partial<FSRSConfig> & { clock?: Clock } = {},
): FSRSScheduler {
  const { clock = systemClock, ...overrides } = options;
  const config: FSRSConfig = { ...DEFAULT_FSRS_CONFIG, ...overrides };

  function initialState(now: Timestamp = clock.now()): SchedulingState {
    return {
      repetitions: 0,
      // Inert under FSRS; carried so the same card can be handed back to SM-2.
      easeFactor: 2.5,
      interval: 0,
      dueAt: now,
      lastReviewedAt: null,
      lapses: 0,
      status: 'new',
      // No `memory` yet: initial stability comes from the first grade.
    };
  }

  function elapsedDaysFor(state: SchedulingState, now: Timestamp): number {
    if (state.lastReviewedAt === null) return 0;
    return Math.max(0, (now - state.lastReviewedAt) / DAY_MS);
  }

  function review(
    state: SchedulingState,
    quality: RecallQuality,
    now: Timestamp = clock.now(),
  ): SchedulingState {
    if (state.status === 'suspended') return state;

    const rating = toFSRSRating(quality);
    const lapsed = rating === 1;
    const elapsedDays = elapsedDaysFor(state, now);

    const memory = applyFSRS(state.memory ?? null, rating, elapsedDays, config);
    const interval = intervalForRetention(
      memory.stability,
      config.desiredRetention,
      config.maximumIntervalDays,
    );

    return {
      repetitions: lapsed ? 0 : state.repetitions + 1,
      easeFactor: state.easeFactor,
      interval,
      dueAt: now + applyFuzz(interval, config.intervalFuzzRatio) * DAY_MS,
      lastReviewedAt: now,
      lapses: lapsed ? state.lapses + 1 : state.lapses,
      status: nextStatus(state, lapsed),
      memory,
    };
  }

  function nextStatus(state: SchedulingState, lapsed: boolean): SchedulingState['status'] {
    if (lapsed) {
      return config.enableRelearning && state.status === 'review' ? 'relearning' : 'learning';
    }
    // FSRS has no learning-step ladder: one successful review is enough to put
    // a card on the long-term curve, because stability already encodes how
    // fragile that memory is.
    return 'review';
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
      lapsed: toFSRSRating(quality) === 1,
    };

    return { card: { ...card, scheduling: after, updatedAt: now }, log };
  }

  function isDue(card: Card, now: Timestamp = clock.now(), fuzzMs = 0): boolean {
    if (card.scheduling.status === 'suspended') return false;
    return card.scheduling.dueAt <= now + fuzzMs;
  }

  function preview(
    card: Card,
    now: Timestamp = clock.now(),
  ): Record<RecallQuality, SchedulePreview> {
    const qualities: RecallQuality[] = [0, 1, 2, 3, 4, 5];
    const elapsedDays = elapsedDaysFor(card.scheduling, now);

    // No fuzz here: a preview has to match what actually happens closely
    // enough that the button label is not a lie.
    const entries = qualities.map((quality) => {
      const rating = toFSRSRating(quality);
      const memory = applyFSRS(card.scheduling.memory ?? null, rating, elapsedDays, config);
      const intervalDays = intervalForRetention(
        memory.stability,
        config.desiredRetention,
        config.maximumIntervalDays,
      );

      return [
        quality,
        {
          quality,
          intervalDays,
          dueAt: now + intervalDays * DAY_MS,
          lapses: rating === 1,
        },
      ] as const;
    });

    return Object.fromEntries(entries) as Record<RecallQuality, SchedulePreview>;
  }

  function retrievabilityOf(card: Card, now: Timestamp = clock.now()): number {
    const { memory } = card.scheduling;
    if (!memory) return 1;
    return retrievability(elapsedDaysFor(card.scheduling, now), memory.stability);
  }

  return {
    algorithm: 'fsrs',
    config,
    initialState,
    grade,
    review,
    isDue,
    preview,
    retrievabilityOf,
  };
}

/** A shared default instance, for apps that never need custom config. */
export const fsrsScheduler: FSRSScheduler = createFSRSScheduler();

function snapshot(state: SchedulingState) {
  return {
    repetitions: state.repetitions,
    easeFactor: state.easeFactor,
    interval: state.interval,
    status: state.status,
  };
}

function applyFuzz(intervalDays: number, ratio: number): number {
  if (ratio <= 0 || intervalDays <= 1) return intervalDays;
  const spread = intervalDays * ratio;
  return intervalDays + (Math.random() * 2 - 1) * spread;
}
