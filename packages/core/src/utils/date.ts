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
