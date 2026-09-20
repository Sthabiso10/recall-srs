/**
 * Interval jitter.
 *
 * Cards introduced on the same day earn the same interval, come due on the
 * same day, and stay welded together for years — a deck imported in one sitting
 * turns into a handful of enormous review days separated by empty ones. Jitter
 * breaks that up by nudging each interval a little, independently.
 *
 * ── Why banded rather than a flat percentage ────────────────────────────
 *
 * A flat ±5% is wrong at both ends. On a four-day interval it is ±0.2 days,
 * which rounds away to nothing and never separates anything; on a two-year
 * interval it is ±36 days, which is a real change to the schedule made for
 * purely cosmetic reasons. The banded scheme spends its jitter where it
 * actually does work: generously on short intervals where a day of spread
 * genuinely splits a cohort, sparingly on long ones where the schedule is the
 * point.
 *
 *   interval portion    spread
 *   2.5 - 7 days        ±15%
 *   7 - 20 days         ±10%
 *   beyond 20 days      ±5%
 *
 * plus a flat ±1 day floor, so even the shortest fuzzable interval can move.
 *
 * Ported from `open-spaced-repetition/ts-fsrs` (MIT) `get_fuzz_range` /
 * `apply_fuzz`, cross-checked against `py-fsrs` (MIT) `_get_fuzzed_interval`.
 */

/** Intervals below this many days are never fuzzed. */
export const FUZZ_MIN_INTERVAL_DAYS = 2.5;

/**
 * The bands. Each contributes `factor` × (the portion of the interval falling
 * inside it) to the total spread.
 */
const FUZZ_BANDS: ReadonlyArray<{ start: number; end: number; factor: number }> = [
  { start: 2.5, end: 7, factor: 0.15 },
  { start: 7, end: 20, factor: 0.1 },
  { start: 20, end: Infinity, factor: 0.05 },
];

export interface FuzzRange {
  minDays: number;
  maxDays: number;
}

/**
 * The inclusive day range a given interval may be fuzzed into.
 *
 * `elapsedDays` guards against fuzzing a card *backwards* past the point it has
 * already been waiting: if a card has sat for 30 days and earns a 35-day
 * interval, the low end is pinned to 31 rather than 33, because scheduling it
 * for "three days ago" is not a nudge, it is a card that is instantly overdue.
 */
export function getFuzzRange(
  intervalDays: number,
  elapsedDays: number,
  maximumIntervalDays: number,
): FuzzRange {
  let delta = 1;
  for (const band of FUZZ_BANDS) {
    delta += band.factor * Math.max(Math.min(intervalDays, band.end) - band.start, 0);
  }

  const capped = Math.min(intervalDays, maximumIntervalDays);

  let minDays = Math.max(2, Math.round(capped - delta));
  const maxDays = Math.min(Math.round(capped + delta), maximumIntervalDays);

  if (capped > elapsedDays) {
    minDays = Math.max(minDays, elapsedDays + 1);
  }
  minDays = Math.min(minDays, maxDays);

  return { minDays, maxDays };
}

/**
 * Apply banded jitter to an interval.
 *
 * Returns the interval untouched when it is below {@link FUZZ_MIN_INTERVAL_DAYS}.
 * That guard is what keeps relearning working: a ten-minute step is 0.007 days,
 * and the canonical implementation would round it to a whole day — i.e.
 * tomorrow — which is precisely the outcome the relearning ladder exists to
 * avoid. Sub-day intervals pass through unrounded here.
 *
 * `random` must return a value in [0, 1). Inject a seeded generator to make
 * scheduling reproducible in tests.
 */
export function fuzzIntervalBanded(
  intervalDays: number,
  elapsedDays: number,
  maximumIntervalDays: number,
  random: () => number,
): number {
  if (intervalDays < FUZZ_MIN_INTERVAL_DAYS) return intervalDays;

  const { minDays, maxDays } = getFuzzRange(intervalDays, elapsedDays, maximumIntervalDays);
  const fuzzed = Math.floor(random() * (maxDays - minDays + 1) + minDays);

  return Math.min(fuzzed, maximumIntervalDays);
}

/**
 * The older flat-percentage jitter: uniform in ±`ratio` of the interval.
 *
 * Kept because configurations that set `intervalFuzzRatio` should keep
 * scheduling the way they did. New code wants {@link fuzzIntervalBanded}.
 */
export function fuzzIntervalByRatio(
  intervalDays: number,
  ratio: number,
  random: () => number,
): number {
  if (ratio <= 0) return intervalDays;
  const spread = intervalDays * ratio;
  return Math.max(0, intervalDays + (random() * 2 - 1) * spread);
}
