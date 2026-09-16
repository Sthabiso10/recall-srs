/**
 * Session and queue behaviour. These cover the plumbing around the algorithm —
 * the parts already implemented, so they should be green from a clean checkout.
 */

import {
  buildQueue,
  createCard,
  createScheduler,
  createStudySession,
  offsetClock,
} from '../src/index';
import type { Card, ReviewLog } from '../src/index';

const NOW = Date.parse('2026-01-01T09:00:00.000Z');

function deck(count: number, overrides: Partial<Card> = {}): Card[] {
  return Array.from({ length: count }, (_, i) =>
    ({
      ...createCard({ question: `q${i}`, answer: `a${i}`, tags: ['korean'] }, NOW + i),
      ...overrides,
    }) as Card,
  );
}

describe('buildQueue', () => {
  it('caps new cards at newCardsPerDay', () => {
    const queue = buildQueue({
      cards: deck(50),
      settings: { newCardsPerDay: 10 },
      now: NOW,
    });
    expect(queue).toHaveLength(10);
  });

  it('honours the session limit over the deck settings', () => {
    const queue = buildQueue({
      cards: deck(50),
      config: { limit: 5 },
      settings: { newCardsPerDay: 20 },
      now: NOW,
    });
    expect(queue).toHaveLength(5);
  });

  it('excludes suspended cards', () => {
    const cards = deck(3);
    const [first] = cards;
    if (first) first.scheduling.status = 'suspended';

    const queue = buildQueue({ cards, now: NOW });
    expect(queue).toHaveLength(2);
    expect(queue).not.toContain(first?.id);
  });

  it('filters by tag', () => {
    const cards = [
      ...deck(2),
      createCard({ question: 'x', answer: 'y', tags: ['spanish'] }, NOW),
    ];
    const queue = buildQueue({ cards, config: { tags: ['spanish'] }, now: NOW });
    expect(queue).toHaveLength(1);
  });
});

describe('createStudySession', () => {
  it('walks the queue and reports progress', async () => {
    const session = createStudySession({
      cards: deck(3),
      clock: offsetClock(NOW),
      scheduler: createScheduler(),
    });

    expect(session.remaining()).toBe(3);
    expect(session.progress()).toBe(0);

    await session.grade(5);
    expect(session.remaining()).toBe(2);
    expect(session.progress()).toBeCloseTo(1 / 3);

    await session.grade(4);
    await session.grade(3);
    expect(session.remaining()).toBe(0);
    expect(session.getCurrentCard()).toBeNull();
  });

  it('calls onReview with the updated card and its log', async () => {
    const saved: ReviewLog[] = [];
    const session = createStudySession({
      cards: deck(1),
      clock: offsetClock(NOW),
      onReview: ({ log }) => {
        saved.push(log);
      },
    });

    await session.grade(5);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.quality).toBe(5);
  });

  it('re-queues lapsed cards when requeueLapses is on', async () => {
    const session = createStudySession({
      cards: deck(2),
      config: { requeueLapses: true },
      clock: offsetClock(NOW),
    });

    await session.grade(1); // lapse -> goes to the back
    expect(session.remaining()).toBe(2);
  });

  it('throws rather than silently no-op when grading an empty queue', async () => {
    const session = createStudySession({ cards: [], clock: offsetClock(NOW) });
    await expect(session.grade(5)).rejects.toThrow(/no current card/i);
  });

  it('summarises the sitting on end()', async () => {
    const session = createStudySession({ cards: deck(4), clock: offsetClock(NOW) });

    await session.grade(5);
    await session.grade(1);
    const summary = await session.end();

    expect(summary.cardsReviewed).toBe(2);
    expect(summary.correct).toBe(1);
    expect(summary.lapsed).toBe(1);
    expect(summary.accuracy).toBeCloseTo(0.5);
  });

  it('returns a zeroed summary rather than NaN for an empty session', async () => {
    const session = createStudySession({ cards: [], clock: offsetClock(NOW) });
    const summary = await session.end();

    expect(summary.accuracy).toBe(0);
    expect(summary.averageQuality).toBe(0);
  });
});
