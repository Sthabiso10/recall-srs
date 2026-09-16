/**
 * Statistics and analytics.
 *
 * Everything here is derived from `Card[]` and `ReviewLog[]` — no state of its
 * own, nothing cached. That is why review logs must never be deleted: throw
 * away the log and these numbers become unrecoverable.
 */

import type {
  Card,
  CardStatus,
  DeckStats,
  ForecastPoint,
  RetentionPoint,
  ReviewLog,
  SessionId,
  SessionSummary,
  Timestamp,
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

export interface DeckStatsOptions {
  now?: Timestamp;
  /**
   * Interval, in days, at which a card counts as "mature".
   *
   * Retention is reported over mature cards only, which is the standard
   * convention. Young cards are reviewed so often that including them flatters
   * the number badly — a deck of brand-new cards can show 95% retention while
   * teaching nobody anything.
   */
  matureIntervalDays?: number;
}

/**
 * Headline numbers for `<ProgressDashboard>`.
 *
 * Note `averageEaseFactor` and the FSRS fields are mutually exclusive in
 * practice: ease factor is an SM-2 concept, stability and difficulty are FSRS
 * ones. Whichever algorithm is not in use leaves its fields at 0, so render
 * them based on `scheduler.algorithm` rather than on truthiness.
 */
export function computeDeckStats(
  cards: readonly Card[],
  reviews: readonly ReviewLog[],
  options: DeckStatsOptions = {},
): DeckStats {
  const { now = Date.now(), matureIntervalDays = 21 } = options;

  const byStatus: Record<CardStatus, number> = {
    new: 0,
    learning: 0,
    review: 0,
    relearning: 0,
    suspended: 0,
  };

  let easeSum = 0;
  let easeCount = 0;
  let stabilitySum = 0;
  let difficultySum = 0;
  let memoryCount = 0;
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
    if (card.scheduling.memory) {
      stabilitySum += card.scheduling.memory.stability;
      difficultySum += card.scheduling.memory.difficulty;
      memoryCount += 1;
    }
    if (card.scheduling.dueAt <= now) dueNow += 1;
    if (card.scheduling.dueAt < endOfToday) dueToday += 1;
  }

  const mature = reviews.filter((r) => r.previous.interval >= matureIntervalDays);
  const passed = mature.filter((r) => r.quality >= PASSING_QUALITY).length;

  return {
    total: cards.length,
    byStatus,
    dueNow,
    dueToday,
    averageEaseFactor: easeCount === 0 ? 0 : easeSum / easeCount,
    averageStability: memoryCount === 0 ? 0 : stabilitySum / memoryCount,
    averageDifficulty: memoryCount === 0 ? 0 : difficultySum / memoryCount,
    retentionRate: mature.length === 0 ? 0 : passed / mature.length,
    matureReviewCount: mature.length,
    streakDays: computeStreak(reviews, now),
  };
}

/**
 * Consecutive days with at least one review, counting back from today.
 *
 * Today not yet being studied does not break a streak — otherwise every
 * learner's streak would read zero each morning, which is both wrong and
 * demoralising. The count starts at yesterday when today is empty.
 */
export function computeStreak(reviews: readonly ReviewLog[], now: Timestamp = Date.now()): number {
  if (reviews.length === 0) return 0;

  const days = new Set<number>();
  for (const review of reviews) days.add(startOfDay(review.reviewedAt));

  const today = startOfDay(now);
  let cursor = days.has(today) ? today : today - DAY_MS;
  let streak = 0;

  while (days.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }

  return streak;
}

/** Bucket edges, in days, for the retention curve. */
const RETENTION_BUCKETS = [1, 3, 7, 14, 30, 60, Infinity];

export interface RetentionOptions {
  /**
   * Minimum reviews before a bucket is reported. A 100% bar built on two
   * reviews is noise, and noise on a chart reads as signal.
   */
  minSampleSize?: number;
}

/**
 * The retention curve: how well recall holds up as intervals get longer.
 *
 * Reviews are bucketed by the interval they were *scheduled at*
 * (`log.previous.interval`), then reported as a pass rate per bucket. A healthy
 * curve sits flat around 0.85-0.9. If it sags at long intervals your intervals
 * are outrunning actual memory — under FSRS, raise `desiredRetention`.
 */
export function computeRetentionCurve(
  reviews: readonly ReviewLog[],
  { minSampleSize = 10 }: RetentionOptions = {},
): RetentionPoint[] {
  if (reviews.length === 0) return [];

  const buckets = new Map<number, { total: number; passed: number }>();

  for (const review of reviews) {
    // Skip first-ever reviews: interval 0 says nothing about retention.
    if (review.previous.interval <= 0) continue;

    const edge = RETENTION_BUCKETS.find((b) => review.previous.interval <= b);
    if (edge === undefined) continue;

    const bucket = buckets.get(edge) ?? { total: 0, passed: 0 };
    bucket.total += 1;
    if (review.quality >= PASSING_QUALITY) bucket.passed += 1;
    buckets.set(edge, bucket);
  }

  return [...buckets.entries()]
    .filter(([, b]) => b.total >= minSampleSize)
    .sort((a, b) => a[0] - b[0])
    .map(([edge, b]) => ({
      intervalDays: edge === Infinity ? 60 : edge,
      reviewCount: b.total,
      retention: b.passed / b.total,
    }));
}

/**
 * Upcoming workload: how many cards fall due on each of the next `days` days.
 *
 * The single best drop-off predictor in an SRS app. A visible 300-card Thursday
 * gives the learner a chance to spread the load; an invisible one just makes
 * them quit on Thursday.
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

export interface LoadBalanceOptions {
  /** How many days either side a card may be moved. Default 2. */
  maxShiftDays?: number;
  /** Target ceiling per day. Defaults to the mean over the window. */
  targetPerDay?: number;
  now?: Timestamp;
  /** Days to look ahead. Default 30. */
  days?: number;
}

export interface LoadBalanceMove {
  cardId: string;
  fromDueAt: Timestamp;
  toDueAt: Timestamp;
  shiftDays: number;
}

/**
 * Spread due dates to flatten spikes in the forecast.
 *
 * `computeForecast` already shows the 300-card Thursday; this proposes what to
 * do about it. Cards on overloaded days are nudged by up to `maxShiftDays` onto
 * lighter neighbouring days.
 *
 * Shifting a review by a day or two costs very little retention — the
 * forgetting curve is shallow at that scale — while a wall of 300 cards costs
 * you the learner entirely. That trade is why every mature SRS does this.
 *
 * Returns proposed moves; it does not mutate anything. Apply them by writing
 * `toDueAt` onto each card and saving.
 */
export function computeLoadBalance(
  cards: readonly Card[],
  {
    maxShiftDays = 2,
    targetPerDay,
    now = Date.now(),
    days = 30,
  }: LoadBalanceOptions = {},
): LoadBalanceMove[] {
  const today = startOfDay(now);
  const forecast = computeForecast(cards, days, now);
  const counts = forecast.map((p) => p.dueCount);

  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  const target = targetPerDay ?? Math.ceil(total / days);

  // Never move a card that is already due or overdue — the learner is looking
  // at it now, and deferring it would be indistinguishable from losing it.
  const movable = cards.filter(
    (c) => c.scheduling.status !== 'suspended' && startOfDay(c.scheduling.dueAt) > today,
  );

  const byDay = new Map<number, Card[]>();
  for (const card of movable) {
    const offset = Math.round((startOfDay(card.scheduling.dueAt) - today) / DAY_MS);
    if (offset < 0 || offset >= days) continue;
    byDay.set(offset, [...(byDay.get(offset) ?? []), card]);
  }

  const moves: LoadBalanceMove[] = [];

  for (let day = 0; day < days; day++) {
    const onDay = byDay.get(day) ?? [];
    let overflow = (counts[day] ?? 0) - target;
    if (overflow <= 0) continue;

    // Move the least fragile cards first: longer intervals tolerate a nudge
    // better than a card that only just graduated.
    const candidates = [...onDay].sort((a, b) => b.scheduling.interval - a.scheduling.interval);

    for (const card of candidates) {
      if (overflow <= 0) break;

      let best: number | null = null;
      for (let shift = 1; shift <= maxShiftDays; shift++) {
        for (const candidateDay of [day + shift, day - shift]) {
          if (candidateDay <= 0 || candidateDay >= days) continue;
          if ((counts[candidateDay] ?? 0) < target) {
            best = candidateDay;
            break;
          }
        }
        if (best !== null) break;
      }
      if (best === null) continue;

      counts[day] = (counts[day] ?? 0) - 1;
      counts[best] = (counts[best] ?? 0) + 1;
      overflow -= 1;

      moves.push({
        cardId: card.id,
        fromDueAt: card.scheduling.dueAt,
        toDueAt: today + best * DAY_MS,
        shiftDays: best - day,
      });
    }
  }

  return moves;
}
