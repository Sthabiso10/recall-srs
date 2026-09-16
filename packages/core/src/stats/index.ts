/**
 * Statistics and analytics.
 *
 * Everything here is derived from `Card[]` and `ReviewLog[]` — no state of its
 * own, nothing cached. That is why review logs must never be deleted: throw
 * away the log and these numbers become unrecoverable.
 *
 * `summarizeSession` is implemented (the session needs it). The rest are
 * skeletons with their contracts written down for you to fill in.
 */

import type {
  Card,
  DeckStats,
  ForecastPoint,
  RetentionPoint,
  ReviewLog,
  SessionId,
  SessionSummary,
  Timestamp,
  CardStatus,
} from '../types/index';
import { PASSING_QUALITY } from '../types/index';
import { DAY_MS, startOfDay, startOfNextDay } from '../utils/date';

/** Roll a session's review logs into the numbers behind the summary screen. */
export function summarizeSession(
  sessionId: SessionId,
  startedAt: Timestamp,
  endedAt: Timestamp,
  reviews: readonly ReviewLog[],
): SessionSummary {
  const cardsReviewed = reviews.length;
  const correct = reviews.filter((r) => !r.lapsed).length;
  const totalQuality = reviews.reduce((sum, r) => sum + r.quality, 0);
  const totalDuration = reviews.reduce((sum, r) => sum + r.durationMs, 0);

  return {
    sessionId,
    startedAt,
    endedAt,
    durationMs: endedAt - startedAt,
    cardsReviewed,
    correct,
    lapsed: cardsReviewed - correct,
    // Guard every division: an abandoned session with zero reviews should
    // render "0%", not "NaN%".
    accuracy: cardsReviewed === 0 ? 0 : correct / cardsReviewed,
    averageQuality: cardsReviewed === 0 ? 0 : totalQuality / cardsReviewed,
    averageDurationMs: cardsReviewed === 0 ? 0 : totalDuration / cardsReviewed,
  };
}

/**
 * Headline numbers for `<ProgressDashboard>`.
 *
 * TODO(you): fill in `retentionRate` and `streakDays`.
 *   - retentionRate: share of all reviews graded at or above PASSING_QUALITY.
 *     Decide whether to count only mature cards (interval >= 21 days) — the
 *     usual convention, since young-card accuracy flatters the number.
 *   - streakDays: consecutive local calendar days with at least one review,
 *     counting back from today. Today not yet studied should not break a
 *     streak — start the count at yesterday if today is empty.
 */
export function computeDeckStats(
  cards: readonly Card[],
  reviews: readonly ReviewLog[],
  now: Timestamp = Date.now(),
): DeckStats {
  const byStatus: Record<CardStatus, number> = {
    new: 0,
    learning: 0,
    review: 0,
    relearning: 0,
    suspended: 0,
  };

  let easeSum = 0;
  let easeCount = 0;
  let dueNow = 0;
  let dueToday = 0;
  const endOfToday = startOfNextDay(now);

  for (const card of cards) {
    byStatus[card.scheduling.status] += 1;
    if (card.scheduling.status === 'suspended') continue;

    if (card.scheduling.repetitions > 0) {
      easeSum += card.scheduling.easeFactor;
      easeCount += 1;
    }
    if (card.scheduling.dueAt <= now) dueNow += 1;
    if (card.scheduling.dueAt < endOfToday) dueToday += 1;
  }

  const passed = reviews.filter((r) => r.quality >= PASSING_QUALITY).length;

  return {
    total: cards.length,
    byStatus,
    dueNow,
    dueToday,
    averageEaseFactor: easeCount === 0 ? 0 : easeSum / easeCount,
    retentionRate: reviews.length === 0 ? 0 : passed / reviews.length,
    streakDays: 0, // TODO
  };
}

/**
 * The retention curve: how well recall holds up as intervals get longer.
 *
 * Bucket reviews by the interval they were scheduled at (`log.previous.interval`),
 * then report the pass rate per bucket. A healthy curve stays roughly flat
 * around 0.85-0.9 — if it sags at long intervals, your ease factors are too
 * generous and intervals are outrunning actual memory.
 *
 * TODO(you): bucket sensibly (1, 2-3, 4-7, 8-14, 15-30, 31+ days rather than
 * one bucket per distinct interval) and drop buckets with too few reviews to
 * mean anything — a 100% retention bar built on two reviews is noise.
 */
export function computeRetentionCurve(
  reviews: readonly ReviewLog[],
  _options: { minSampleSize?: number } = {},
): RetentionPoint[] {
  void reviews;
  return [];
}

/**
 * Upcoming workload: how many cards fall due on each of the next `days` days.
 *
 * The single best drop-off predictor in an SRS app. A visible 300-card
 * Thursday gives the learner a chance to spread the load; an invisible one
 * just makes them quit on Thursday.
 *
 * Counts currently-scheduled due dates only — it does not simulate reviews
 * that will themselves generate new due dates.
 */
export function computeForecast(
  cards: readonly Card[],
  days = 30,
  now: Timestamp = Date.now(),
): ForecastPoint[] {
  const today = startOfDay(now);
  const points: ForecastPoint[] = Array.from({ length: days }, (_, dayOffset) => ({
    dayOffset,
    date: today + dayOffset * DAY_MS,
    dueCount: 0,
  }));

  for (const card of cards) {
    if (card.scheduling.status === 'suspended') continue;
    // Anything overdue lands on day 0 — it is due now, not in the past.
    const offset = Math.max(0, Math.round((startOfDay(card.scheduling.dueAt) - today) / DAY_MS));
    const point = points[offset];
    if (point) point.dueCount += 1;
  }

  return points;
}
