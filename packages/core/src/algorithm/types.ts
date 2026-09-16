/**
 * The scheduler contract.
 *
 * Both SM-2 and FSRS implement this, and so can anything else. Nothing above
 * this layer — not the session, not the queue, not a single React component —
 * knows which algorithm is running. Swapping them is one line at the provider:
 *
 *   <SRSProvider adapter={adapter} scheduler={createFSRSScheduler()} />
 *
 * Keep this interface free of algorithm-specific concepts. "Ease factor" is an
 * SM-2 idea; "stability" is an FSRS idea; neither belongs here. What belongs
 * here is what every scheduler must answer: when is this card next due, and
 * what would each grade do to it.
 */

import type {
  Card,
  RecallQuality,
  ReviewLog,
  SchedulingState,
  SessionId,
  Timestamp,
} from '../types/index';

export interface GradeOptions {
  /** Overrides the clock. Pass it when replaying history or testing. */
  now?: Timestamp;
  /** Time the learner spent on the card, recorded on the log. */
  durationMs?: number;
  sessionId?: SessionId;
}

export interface GradeResult {
  /** A new card object with updated scheduling. The input is never mutated. */
  card: Card;
  /** The history entry. Persist it with `storage.saveReview`. */
  log: ReviewLog;
}

export interface SchedulePreview {
  quality: RecallQuality;
  intervalDays: number;
  dueAt: Timestamp;
  /** True when this grade would count as a lapse. */
  lapses: boolean;
}

/**
 * `TConfig` is the algorithm's own tuning object — `SchedulerConfig` for SM-2,
 * `FSRSConfig` for FSRS. It defaults to `unknown` so code that does not care
 * can just say `Scheduler`.
 */
export interface Scheduler<TConfig = unknown> {
  /**
   * Which algorithm this is. Useful for UI ("this deck uses FSRS") and for
   * stats that only make sense under one of them — `averageEaseFactor` is
   * meaningless for an FSRS deck, for instance.
   */
  readonly algorithm: 'sm2' | 'fsrs' | (string & {});

  readonly config: TConfig;

  /** Scheduling state for a card that has never been reviewed. */
  initialState(now?: Timestamp): SchedulingState;

  /** Apply a grade to a card, producing the updated card and its review log. */
  grade(card: Card, quality: RecallQuality, options?: GradeOptions): GradeResult;

  /** Apply a grade to bare scheduling state. Useful outside the `Card` model. */
  review(state: SchedulingState, quality: RecallQuality, now?: Timestamp): SchedulingState;

  /** Is this card reviewable right now? Respects `dueFuzzMs` when given. */
  isDue(card: Card, now?: Timestamp, fuzzMs?: number): boolean;

  /**
   * What each grade would schedule, without committing to anything.
   *
   * This is what lets `<StudyView>` label its buttons "Again / 10m / 1d / 4d"
   * instead of "0 / 3 / 4 / 5" — the single highest-leverage UX detail in any
   * SRS app, so it is a first-class API rather than an add-on.
   */
  preview(card: Card, now?: Timestamp): Record<RecallQuality, SchedulePreview>;
}
