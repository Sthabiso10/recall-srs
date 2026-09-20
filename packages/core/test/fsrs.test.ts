/**
 * FSRS behaviour.
 *
 * These assert *invariants of the model*, not specific numbers, so they stay
 * green when you re-fit the weights or move to a newer FSRS version. The one
 * exact assertion is R(S, S) = 0.9, which is definitional — if that breaks,
 * "stability" no longer means what the whole model says it means.
 */

import {
  FSRS_5_DEFAULT_WEIGHTS,
  FSRS_6_DEFAULT_WEIGHTS,
  DEFAULT_FSRS_CONFIG,
  applyFSRS,
  createCard,
  createFSRSScheduler,
  intervalForRetention,
  nextDifficulty,
  retrievability,
  toFSRSRating,
} from '../src/index';
import type { Card, MemoryState } from '../src/index';

const NOW = Date.parse('2026-01-01T09:00:00.000Z');
const DAY = 86_400_000;
const config = DEFAULT_FSRS_CONFIG;

function card(overrides: Partial<Card> = {}): Card {
  return { ...createCard({ question: '물', answer: 'water' }, NOW), ...overrides } as Card;
}

describe('the forgetting curve', () => {
  it('gives exactly 90% recall at t = stability (the definition of stability)', () => {
    // Holds for any decay, not just FSRS-5's fixed -0.5: FACTOR is derived
    // from DECAY precisely to preserve this identity. If it ever stops
    // holding, "stability" has silently stopped meaning what the docs say.
    //
    // Eight decimals, not ten: `decayFactorFor` rounds FACTOR to 8 places
    // exactly as the reference implementations do, so that a schedule
    // computed here matches one computed by ts-fsrs bit for bit. The residual
    // is ~3e-10 on a probability.
    for (const S of [1, 7, 30, 365]) {
      expect(retrievability(S, S)).toBeCloseTo(0.9, 8);
      expect(retrievability(S, S, FSRS_5_DEFAULT_WEIGHTS)).toBeCloseTo(0.9, 8);
      expect(retrievability(S, S, FSRS_6_DEFAULT_WEIGHTS)).toBeCloseTo(0.9, 8);
    }
  });

  it('starts at 100% and decays monotonically', () => {
    expect(retrievability(0, 10)).toBeCloseTo(1, 10);

    let previous = 1;
    for (const t of [1, 5, 10, 50, 200]) {
      const r = retrievability(t, 10);
      expect(r).toBeLessThan(previous);
      expect(r).toBeGreaterThan(0);
      previous = r;
    }
  });

  it('decays more slowly for more stable memories', () => {
    expect(retrievability(30, 100)).toBeGreaterThan(retrievability(30, 10));
  });
});

describe('intervalForRetention', () => {
  it('returns the stability itself at the 90% target', () => {
    // Round-trips the curve: I(0.9, S) === S, by construction.
    expect(intervalForRetention(10, 0.9, 36_500)).toBe(10);
  });

  it('shortens intervals when you ask for higher retention', () => {
    const relaxed = intervalForRetention(100, 0.85, 36_500);
    const standard = intervalForRetention(100, 0.9, 36_500);
    const strict = intervalForRetention(100, 0.95, 36_500);

    expect(strict).toBeLessThan(standard);
    expect(standard).toBeLessThan(relaxed);
  });

  it('never returns less than a day or more than the cap', () => {
    expect(intervalForRetention(0.001, 0.9, 36_500)).toBe(1);
    expect(intervalForRetention(1e9, 0.9, 365)).toBe(365);
  });
});

describe('difficulty', () => {
  it('stays within [1, 10] under sustained pressure in either direction', () => {
    let hard = 5;
    let easy = 5;
    for (let i = 0; i < 50; i++) {
      hard = nextDifficulty(hard, 1, config); // Again, forever
      easy = nextDifficulty(easy, 4, config); // Easy, forever
    }
    expect(hard).toBeGreaterThanOrEqual(1);
    expect(hard).toBeLessThanOrEqual(10);
    expect(easy).toBeGreaterThanOrEqual(1);
    expect(easy).toBeLessThanOrEqual(10);
  });

  it('rises on Again and falls on Easy', () => {
    expect(nextDifficulty(5, 1, config)).toBeGreaterThan(5);
    expect(nextDifficulty(5, 4, config)).toBeLessThan(5);
  });
});

describe('stability', () => {
  const memory: MemoryState = { stability: 10, difficulty: 5 };

  it('grows on a successful recall', () => {
    const next = applyFSRS(memory, 3, 10, config);
    expect(next.stability).toBeGreaterThan(memory.stability);
  });

  it('never exceeds the pre-lapse stability after a lapse', () => {
    // The FSRS-5 clamp: forgetting a card cannot make it more durable.
    for (const S of [1, 10, 100, 1000]) {
      const next = applyFSRS({ stability: S, difficulty: 5 }, 1, S, config);
      expect(next.stability).toBeLessThanOrEqual(S);
      expect(next.stability).toBeGreaterThan(0);
    }
  });

  it('rewards recalling a card you were closer to forgetting', () => {
    // Same grade, same card — but reviewed late, when retrievability is lower.
    const onTime = applyFSRS(memory, 3, 10, config);
    const overdue = applyFSRS(memory, 3, 40, config);
    expect(overdue.stability).toBeGreaterThan(onTime.stability);
  });

  it('barely moves on a same-day repeat', () => {
    const sameDay = applyFSRS(memory, 3, 0.01, config);
    const nextDay = applyFSRS(memory, 3, 10, config);
    expect(sameDay.stability).toBeLessThan(nextDay.stability);
  });

  it('seeds state from the first grade alone', () => {
    const again = applyFSRS(null, 1, 0, config);
    const easy = applyFSRS(null, 4, 0, config);

    expect(again.stability).toBeGreaterThan(0);
    expect(easy.stability).toBeGreaterThan(again.stability);
    expect(easy.difficulty).toBeLessThan(again.difficulty);
  });
});

describe('toFSRSRating', () => {
  it('collapses every SM-2 failure grade onto Again', () => {
    expect(toFSRSRating(0)).toBe(1);
    expect(toFSRSRating(1)).toBe(1);
    expect(toFSRSRating(2)).toBe(1);
  });

  it('maps the passing grades onto Hard / Good / Easy', () => {
    expect(toFSRSRating(3)).toBe(2);
    expect(toFSRSRating(4)).toBe(3);
    expect(toFSRSRating(5)).toBe(4);
  });
});

describe('createFSRSScheduler', () => {
  const scheduler = createFSRSScheduler();

  it('reports its algorithm, so UI and stats can branch on it', () => {
    expect(scheduler.algorithm).toBe('fsrs');
  });

  it('writes memory state on the first review and not before', () => {
    const fresh = card();
    expect(fresh.scheduling.memory).toBeUndefined();

    const { card: graded } = scheduler.grade(fresh, 4, { now: NOW });
    expect(graded.scheduling.memory?.stability).toBeGreaterThan(0);
    expect(graded.scheduling.memory?.difficulty).toBeGreaterThanOrEqual(1);
  });

  it('leaves the input card untouched', () => {
    const subject = card();
    const before = JSON.stringify(subject);
    scheduler.grade(subject, 5, { now: NOW });
    expect(JSON.stringify(subject)).toBe(before);
  });

  it('lengthens intervals over a run of Good grades', () => {
    let subject = card();
    let at = NOW;
    const intervals: number[] = [];

    for (let i = 0; i < 5; i++) {
      const { card: next } = scheduler.grade(subject, 4, { now: at });
      subject = next;
      intervals.push(next.scheduling.interval);
      at = next.scheduling.dueAt;
    }

    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]!).toBeGreaterThanOrEqual(intervals[i - 1]!);
    }
  });

  it('sends a lapsed review card to relearning and counts the lapse', () => {
    let subject = card();
    // Easy graduates in one grade; Good would leave the card on the learning
    // ladder, where failing it is not a lapse.
    ({ card: subject } = scheduler.grade(subject, 5, { now: NOW }));
    ({ card: subject } = scheduler.grade(subject, 0, { now: NOW + 10 * DAY }));

    expect(subject.scheduling.status).toBe('relearning');
    expect(subject.scheduling.lapses).toBe(1);
    expect(subject.scheduling.repetitions).toBe(0);
  });

  it('schedules a stricter retention target more aggressively', () => {
    const relaxed = createFSRSScheduler({ desiredRetention: 0.85 });
    const strict = createFSRSScheduler({ desiredRetention: 0.95 });

    const a = relaxed.grade(card(), 4, { now: NOW }).card.scheduling.interval;
    const b = strict.grade(card(), 4, { now: NOW }).card.scheduling.interval;

    expect(b).toBeLessThanOrEqual(a);
  });

  it('previews all six grades for the rating buttons', () => {
    const preview = scheduler.preview(card(), NOW);

    expect(Object.keys(preview)).toHaveLength(6);
    expect(preview[0].lapses).toBe(true);
    expect(preview[5].lapses).toBe(false);
    expect(preview[5].intervalDays).toBeGreaterThanOrEqual(preview[3].intervalDays);
  });

  it('reports current recall probability, which SM-2 cannot', () => {
    const { card: graded } = scheduler.grade(card(), 4, { now: NOW });
    const S = graded.scheduling.memory!.stability;

    expect(scheduler.retrievabilityOf(graded, NOW)).toBeCloseTo(1, 6);
    expect(scheduler.retrievabilityOf(graded, NOW + S * DAY)).toBeCloseTo(0.9, 6);
  });

  it('never schedules a suspended card', () => {
    const suspended = card();
    suspended.scheduling.status = 'suspended';
    expect(scheduler.isDue(suspended, NOW)).toBe(false);
  });
});

describe('interoperability with SM-2', () => {
  it('accepts a card that SM-2 already scheduled, with no migration', () => {
    // An SM-2 card has easeFactor/repetitions but no `memory`. FSRS should
    // pick it up and seed memory from the next grade.
    const legacy = card({
      scheduling: {
        repetitions: 4,
        easeFactor: 2.36,
        interval: 21,
        dueAt: NOW,
        lastReviewedAt: NOW - 21 * DAY,
        lapses: 1,
        status: 'review',
      },
    });

    const { card: migrated } = createFSRSScheduler().grade(legacy, 4, { now: NOW });

    expect(migrated.scheduling.memory).toBeDefined();
    expect(migrated.scheduling.interval).toBeGreaterThan(0);
    // The SM-2 field is carried through untouched, so you can switch back.
    expect(migrated.scheduling.easeFactor).toBe(2.36);
  });
});
