/**
 * The clock port.
 *
 * Scheduling is a pure function of "now", so "now" has to be injectable.
 * Every public API that cares about time takes an optional `now` argument and
 * falls back to the configured clock. Tests use `fixedClock` / `offsetClock`
 * to fast-forward three months without waiting three months.
 */

import type { Timestamp } from '../types/index';

export interface Clock {
  now(): Timestamp;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

/** A clock frozen at one instant. Handy for deterministic tests and snapshots. */
export function fixedClock(at: Timestamp): Clock {
  return { now: () => at };
}

/**
 * A clock you can wind forward by hand.
 *
 *   const clock = offsetClock(Date.parse('2026-01-01'));
 *   clock.advanceDays(6);
 *   scheduler.isDue(card, clock.now()); // true
 */
export function offsetClock(start: Timestamp): Clock & {
  advanceMs(ms: number): void;
  advanceDays(days: number): void;
} {
  let current = start;
  return {
    now: () => current,
    advanceMs(ms) {
      current += ms;
    },
    advanceDays(days) {
      current += days * 86_400_000;
    },
  };
}
