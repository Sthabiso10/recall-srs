/**
 * Date helpers. Intentionally tiny and dependency-free — no date-fns, no dayjs.
 *
 * A note on "days": SRS intervals are measured in whole days, but a learner
 * studying at 23:50 and again at 00:10 has crossed a day boundary after 20
 * minutes. `startOfDay` exists so scheduling can reason in local calendar days
 * rather than in 24-hour blocks, which is what learners actually expect.
 */

import type { Timestamp } from '../types/index';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Add a (possibly fractional) number of days to a timestamp. */
export function addDays(at: Timestamp, days: number): Timestamp {
  return at + Math.round(days * DAY_MS);
}

export function addMinutes(at: Timestamp, minutes: number): Timestamp {
  return at + Math.round(minutes * MINUTE_MS);
}

/** Midnight at the start of the local calendar day containing `at`. */
export function startOfDay(at: Timestamp): Timestamp {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Midnight at the start of the next local calendar day. */
export function startOfNextDay(at: Timestamp): Timestamp {
  return startOfDay(at) + DAY_MS;
}

/** Whole calendar days from `a` to `b`. Negative when `b` is earlier. */
export function daysBetween(a: Timestamp, b: Timestamp): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
}

export function isSameDay(a: Timestamp, b: Timestamp): boolean {
  return startOfDay(a) === startOfDay(b);
}

/**
 * Snap a timestamp to the start of a study day.
 *
 * SRS intervals are counted in days, but a learner studying at 23:40 should not
 * get a card back at 23:40 three days later — it would be invisible during
 * their normal morning session. Anki solves this with a rollover hour (default
 * 04:00): everything before that hour still counts as the previous study day.
 *
 * `hour` is the hour at which a new study day begins, 0-23.
 */
export function startOfStudyDay(at: Timestamp, hour = 4): Timestamp {
  const d = new Date(at);
  if (d.getHours() < hour) d.setDate(d.getDate() - 1);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

/**
 * Due timestamp for a card scheduled `intervalDays` from `from`.
 *
 * Intervals of a day or more are anchored to the start of the target study day,
 * so the card is available for the whole of that day. Sub-day intervals (a
 * lapse coming back in ten minutes) are left exact — anchoring those would
 * defer them to tomorrow, which defeats relearning entirely.
 */
export function dueAtFor(
  from: Timestamp,
  intervalDays: number,
  dayStartsAtHour = 4,
): Timestamp {
  if (intervalDays < 1) return from + intervalDays * DAY_MS;
  return startOfStudyDay(from, dayStartsAtHour) + Math.round(intervalDays) * DAY_MS;
}
