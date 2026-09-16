/**
 * Tunable constants for the SM-2 scheduler.
 *
 * The defaults are Piotr Wozniak's original SuperMemo 2 values, which is what
 * you want unless you have review data saying otherwise. Every one of them is
 * overridable per `createScheduler()` call, so an app can loosen intervals for
 * a casual audience without forking the library.
 */

import type { DeckSettings, RecallQuality } from '../types/index';
import { PASSING_QUALITY } from '../types/index';

export interface SchedulerConfig {
  /** Ease factor assigned to a brand-new card. SM-2 default: 2.5 */
  initialEaseFactor: number;
  /**
   * Hard floor on ease factor. Below roughly 1.3 a card becomes a "leech":
   * it comes back so often it crowds out everything else. Clamp, then surface
   * leeches to the user rather than letting the number keep sliding.
   */
  minimumEaseFactor: number;
  /** Optional ceiling. `Infinity` keeps classic SM-2 behaviour. */
  maximumEaseFactor: number;

  /**
   * Intervals (in days) for the first successful reviews, before the ease
   * factor takes over. SM-2 uses [1, 6]: one day after first success, six days
   * after the second, `interval * easeFactor` from then on.
   */
  learningStepsDays: number[];

  /**
   * Interval a card drops to after a lapse. Classic SM-2 sends it all the way
   * back to step one; many modern apps use a fraction of the previous interval
   * instead. Start at 1 and revisit once you have retention data.
   */
  lapseIntervalDays: number;

  /**
   * Ceiling on any computed interval, in days.
   *
   * Default is one year, not ten. A ten-year ceiling is reachable in four Easy
   * grades once ease compounds, and an interval nobody will live to see is
   * indistinguishable from "never shown again" — which is rarely what the
   * learner meant by pressing Easy.
   */
  maximumIntervalDays: number;

  /**
   * Hour at which a new study day begins, 0-23. Reviews before this hour count
   * as the previous day. Due dates for intervals of a day or more are anchored
   * here, so a card studied at 23:40 is available all of its due day rather
   * than from 23:40 onward.
   */
  dayStartsAtHour: number;

  /** Grade at or above which a review counts as a success. */
  passingQuality: RecallQuality;

  /**
   * Randomised +/- jitter applied to computed intervals, as a fraction
   * (0.05 = up to 5%). Prevents cards introduced together from clumping into
   * the same due date forever. Set to 0 for fully deterministic scheduling.
   */
  intervalFuzzRatio: number;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  initialEaseFactor: 2.5,
  minimumEaseFactor: 1.3,
  maximumEaseFactor: Infinity,
  learningStepsDays: [1, 6],
  lapseIntervalDays: 1,
  maximumIntervalDays: 365,
  dayStartsAtHour: 4,
  passingQuality: PASSING_QUALITY as RecallQuality,
  intervalFuzzRatio: 0,
};

export const DEFAULT_DECK_SETTINGS: DeckSettings = {
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
  order: 'due-first',
  // Treat anything due within the next 5 minutes as due now, so a learner
  // never sees an empty screen with a card that unlocks while they sit there.
  dueFuzzMs: 5 * 60_000,
};
