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

import type {
  Card,
  MemoryState,
  RecallQuality,
  ReviewLog,
  SchedulingState,
  Timestamp,
} from '../types/index';
import type { Clock } from '../ports/clock';
import { systemClock } from '../ports/clock';
import { DAY_MS, dueAtFor } from '../utils/date';
import { createId } from '../utils/id';
import type { GradeOptions, GradeResult, SchedulePreview, Scheduler } from './types';
import type { FSRSConfig, FSRSRating } from './fsrs-params';
import { DEFAULT_FSRS_CONFIG, validateFSRSConfig } from './fsrs-params';
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

  /**
   * Grade with a native FSRS rating (1-4) instead of an SM-2 quality (0-5).
   *
   * The 0-5 scale is what `Card` and `ReviewLog` store, so both algorithms can
   * share one history format — but mapping into it is lossy, since FSRS has no
   * way to tell 0 from 2. If your UI shows four buttons (as it should under
   * FSRS), use this and skip the round trip.
   */
  gradeRating(card: Card, rating: FSRSRating, options?: GradeOptions): GradeResult;

  /**
   * Rebuild memory state by replaying a card's full review history.
   *
   * This is the good way to migrate an SM-2 deck: rather than restarting the
   * card from its next grade, replay what the learner actually did and recover
   * the stability and difficulty they had earned. Pass logs oldest-first.
   *
   * Returns null when there is no history to replay.
   */
  reconstructMemory(logs: readonly ReviewLog[]): MemoryState | null;
};

export function createFSRSScheduler(
  options: Partial<FSRSConfig> & { clock?: Clock; random?: () => number } = {},
): FSRSScheduler {
  const { clock = systemClock, random = Math.random, ...overrides } = options;
  const config: FSRSConfig = { ...DEFAULT_FSRS_CONFIG, ...overrides };

  // Fail at construction, not silently at the thousandth review.
  validateFSRSConfig(config);

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
    return reviewWithRating(state, toFSRSRating(quality), now);
  }

  function reviewWithRating(
    state: SchedulingState,
    rating: FSRSRating,
    now: Timestamp = clock.now(),
    /** Previews must not fuzz: the label has to match what actually happens. */
    fuzz = true,
  ): SchedulingState {
    if (state.status === 'suspended') return state;

    const lapsed = rating === 1;
    const elapsedDays = elapsedDaysFor(state, now);

    // Memory is always updated, even mid-relearning: the grade is real evidence
    // about this memory, and discarding it would make the ladder invisible to
    // the model.
    const memory = applyFSRS(state.memory ?? null, rating, elapsedDays, config);

    const steps = config.enableRelearning ? config.relearningStepsMinutes : [];
    const inRelearning = state.status === 'relearning';

    /* --- entering relearning after a lapse --------------------------- */
    if (lapsed && steps.length > 0) {
      return withStep(state, memory, now, 0, steps, {
        lapses: state.lapses + 1,
        repetitions: 0,
      });
    }

    /* --- progressing through the ladder ------------------------------ */
    if (inRelearning && steps.length > 0) {
      const nextStep = (state.learningStep ?? 0) + 1;
      if (nextStep < steps.length) {
        return withStep(state, memory, now, nextStep, steps, {
          lapses: state.lapses,
          repetitions: state.repetitions,
        });
      }
      // Ladder finished: fall through and graduate onto the FSRS interval.
    }

    /* --- normal long-term scheduling --------------------------------- */
    const interval = intervalForRetention(
      memory.stability,
      config.desiredRetention,
      config.maximumIntervalDays,
      config.minimumIntervalDays,
    );

    return {
      repetitions: lapsed ? 0 : state.repetitions + 1,
      easeFactor: state.easeFactor,
      interval,
      dueAt: dueAtFor(
        now,
        fuzz ? applyFuzz(interval, config.intervalFuzzRatio, random) : interval,
        config.dayStartsAtHour,
      ),
      lastReviewedAt: now,
      lapses: lapsed ? state.lapses + 1 : state.lapses,
      status: lapsed ? 'learning' : 'review',
      memory,
    };
  }

  /** Park a card on a relearning step: exact minutes, never day-anchored. */
  function withStep(
    state: SchedulingState,
    memory: MemoryState,
    now: Timestamp,
    step: number,
    steps: readonly number[],
    counters: { lapses: number; repetitions: number },
  ): SchedulingState {
    const minutes = steps[step] ?? steps[steps.length - 1] ?? 10;
    return {
      repetitions: counters.repetitions,
      easeFactor: state.easeFactor,
      interval: minutes / (24 * 60),
      // Deliberately not anchored to the study day — a ten-minute step anchored
      // to a day boundary would become tomorrow, which defeats the point.
      dueAt: now + minutes * 60_000,
      lastReviewedAt: now,
      lapses: counters.lapses,
      status: 'relearning',
      memory,
      learningStep: step,
    };
  }

  function grade(
    card: Card,
    quality: RecallQuality,
    options: GradeOptions = {},
  ): GradeResult {
    return gradeInternal(card, toFSRSRating(quality), quality, options);
  }

  /** Native FSRS path: no lossy 0-5 round trip. */
  function gradeRating(
    card: Card,
    rating: FSRSRating,
    options: GradeOptions = {},
  ): GradeResult {
    // The log still stores an SM-2 quality so history stays one format across
    // both algorithms. This direction is lossless: 1/2/3/4 -> 1/3/4/5.
    const quality = RATING_TO_QUALITY[rating];
    return gradeInternal(card, rating, quality, options);
  }

  function gradeInternal(
    card: Card,
    rating: FSRSRating,
    quality: RecallQuality,
    { now = clock.now(), durationMs = 0, sessionId }: GradeOptions = {},
  ): GradeResult {
    const before = card.scheduling;

    // Grading a suspended card is a caller bug. Returning the card untouched
    // but still emitting a ReviewLog would poison every retention statistic
    // with reviews that never affected a schedule.
    if (before.status === 'suspended') {
      throw new Error(
        `Cannot grade suspended card "${card.id}". Unsuspend it first, or filter ` +
          'suspended cards out of the queue (buildQueue already does).',
      );
    }

    const after = reviewWithRating(before, rating, now);

    const log: ReviewLog = {
      id: createId('rev'),
      cardId: card.id,
      ...(sessionId ? { sessionId } : {}),
      quality,
      reviewedAt: now,
      durationMs,
      previous: snapshot(before),
      next: snapshot(after),
      lapsed: rating === 1,
    };

    return { card: { ...card, scheduling: after, updatedAt: now }, log };
  }

  /**
   * Replay a review history to recover memory state.
   *
   * Each log records when the review happened, so elapsed time between reviews
   * is recoverable — which is exactly what FSRS needs and what makes this a
   * real reconstruction rather than a guess.
   */
  function reconstructMemory(logs: readonly ReviewLog[]): MemoryState | null {
    if (logs.length === 0) return null;

    const ordered = [...logs].sort((a, b) => a.reviewedAt - b.reviewedAt);
    let memory: MemoryState | null = null;
    let previousAt: Timestamp | null = null;

    for (const log of ordered) {
      const elapsedDays = previousAt === null ? 0 : (log.reviewedAt - previousAt) / DAY_MS;
      memory = applyFSRS(memory, toFSRSRating(log.quality), Math.max(0, elapsedDays), config);
      previousAt = log.reviewedAt;
    }

    return memory;
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

    // Run the real scheduler for each grade rather than recomputing the FSRS
    // interval directly. An earlier version did the latter and so ignored the
    // relearning ladder entirely — the Again button advertised "580m" while
    // grading Again actually scheduled 10 minutes. A preview that disagrees
    // with what happens is worse than no preview.
    const entries = qualities.map((quality) => {
      const rating = toFSRSRating(quality);
      const next = reviewWithRating(card.scheduling, rating, now, false);

      return [
        quality,
        {
          quality,
          intervalDays: next.interval,
          dueAt: next.dueAt,
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
    gradeRating,
    reconstructMemory,
  };
}

/** Lossless inverse of `toFSRSRating` for the four ratings FSRS actually uses. */
const RATING_TO_QUALITY: Record<FSRSRating, RecallQuality> = { 1: 1, 2: 3, 3: 4, 4: 5 };

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

function applyFuzz(intervalDays: number, ratio: number, random: () => number): number {
  if (ratio <= 0 || intervalDays <= 1) return intervalDays;
  const spread = intervalDays * ratio;
  return intervalDays + (random() * 2 - 1) * spread;
}
