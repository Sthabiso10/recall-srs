/**
 * SM-2, the pure math.
 *
 * Everything here is a total function of its arguments: no clock, no storage,
 * no randomness (fuzz is applied one layer up, in the scheduler). That makes
 * this the easiest file in the repo to test exhaustively — which matters,
 * because every retention number the library reports traces back to it.
 *
 * ── The algorithm, for reference ────────────────────────────────────────
 *
 * Given quality q (0-5), repetition count n, ease factor EF and interval I:
 *
 *   if q < 3:                      // lapse
 *     n = 0
 *     I = 1                        // back to the start
 *     EF unchanged                 // (SM-2 leaves EF alone on failure)
 *   else:
 *     n = n + 1
 *     I = n === 1 ? 1
 *       : n === 2 ? 6
 *       : round(I_prev * EF)
 *
 *   EF = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 *   EF = max(1.3, EF)
 *
 * The EF adjustment runs on every review, pass or fail, in the original paper;
 * whether you apply it on lapses is a real design decision — note whichever way
 * you go, because it changes long-run interval growth noticeably.
 *
 * ────────────────────────────────────────────────────────────────────────
 *
 * TODO(you): implement the three functions below. The signatures, invariants
 * and tests are already in place — `packages/core/test/sm2.test.ts` describes
 * the behaviour each one owes its callers.
 */

import type { RecallQuality, SchedulingState } from '../types/index';
import type { SchedulerConfig } from './constants';

/**
 * Adjust the ease factor after a review.
 *
 * Invariants the implementation must hold:
 *   - result >= config.minimumEaseFactor, always
 *   - result <= config.maximumEaseFactor, always
 *   - quality 4 leaves the ease factor essentially unchanged (the formula's
 *     fixed point sits just under 4)
 *   - quality 5 raises it, quality <= 3 lowers it
 */
export function nextEaseFactor(
  easeFactor: number,
  quality: RecallQuality,
  config: SchedulerConfig,
): number {
  // TODO: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), then clamp.
  void quality;
  return clamp(easeFactor, config.minimumEaseFactor, config.maximumEaseFactor);
}

/**
 * Compute the next interval in days for a *successful* review.
 *
 * `repetitions` is the count *after* incrementing — a first success arrives
 * here as 1. Walk `config.learningStepsDays` while it has entries left, then
 * fall through to `previousInterval * easeFactor`.
 *
 * Invariants:
 *   - result >= 1
 *   - result <= config.maximumIntervalDays
 *   - monotonic: with a fixed ease factor, more repetitions never shorten it
 */
export function nextInterval(
  previousInterval: number,
  repetitions: number,
  easeFactor: number,
  config: SchedulerConfig,
): number {
  // TODO: learning steps first, then previousInterval * easeFactor, then clamp.
  void previousInterval;
  void easeFactor;
  const step = config.learningStepsDays[repetitions - 1];
  return step ?? 1;
}

/**
 * Apply one graded review to a scheduling state.
 *
 * Pure: returns a new object, never mutates `state`. Does not set `dueAt` —
 * that needs a clock, so the scheduler layer handles it.
 *
 * Invariants:
 *   - quality < config.passingQuality  =>  repetitions === 0, lapses incremented
 *   - quality >= config.passingQuality =>  repetitions === state.repetitions + 1
 *   - `status` moves new/learning -> review once the learning steps are done,
 *     and review -> relearning on a lapse
 *   - a suspended card is returned untouched; suspension outranks scheduling
 */
export function applySM2(
  state: SchedulingState,
  quality: RecallQuality,
  config: SchedulerConfig,
): Omit<SchedulingState, 'dueAt' | 'lastReviewedAt'> {
  if (state.status === 'suspended') {
    const { dueAt: _dueAt, lastReviewedAt: _last, ...rest } = state;
    return rest;
  }

  const passed = quality >= config.passingQuality;
  const easeFactor = nextEaseFactor(state.easeFactor, quality, config);

  // TODO: replace this branch with the real transition table described above.
  if (!passed) {
    return {
      repetitions: 0,
      easeFactor,
      interval: config.lapseIntervalDays,
      lapses: state.lapses + 1,
      status: state.status === 'review' ? 'relearning' : 'learning',
    };
  }

  const repetitions = state.repetitions + 1;
  const interval = nextInterval(state.interval, repetitions, easeFactor, config);

  return {
    repetitions,
    easeFactor,
    interval,
    lapses: state.lapses,
    status: repetitions >= config.learningStepsDays.length ? 'review' : 'learning',
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
