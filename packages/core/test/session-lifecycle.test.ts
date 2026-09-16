/**
 * Session lifecycle: relearning reclaim, resume, queue priority, validation.
 *
 * The reclaim tests exist because the relearning ladder was added in one pass
 * and turned out to be completely inert in the next: the session built its
 * queue once at construction, so a card scheduled ten minutes out was never
 * shown again. A feature that only works in a unit test is not a feature.
 */

import {
  applyLoadBalance,
  buildQueue,
  computeLoadBalance,
  createCard,
  createFSRSScheduler,
  createStudySession,
  offsetClock,
  resumeStudySession,
  validateFSRSConfig,
  DEFAULT_FSRS_CONFIG,
} from '../src/index';
import type { Card } from '../src/index';

const NOW = Date.parse('2026-01-01T09:00:00.000Z');
const MINUTE = 60_000;

function deck(n: number): Card[] {
  return Array.from({ length: n }, (_, i) =>
    createCard({ question: 'q' + i, answer: 'a' + i }, NOW + i),
  );
}

describe('relearning reclaim', () => {
  it('brings a failed card back once its step elapses', async () => {
    const clock = offsetClock(NOW);
    const session = createStudySession({ cards: deck(3), clock });

    await session.grade(0); // fail card 1
    await session.grade(4);
    await session.grade(4);
    expect(session.remaining()).toBe(0);

    clock.advanceMs(11 * MINUTE);
    expect(session.reclaim()).toBe(1);
    expect(session.remaining()).toBe(1);
  });

  it('does not reclaim before the step is due', async () => {
    const clock = offsetClock(NOW);
    const session = createStudySession({ cards: deck(1), clock });

    await session.grade(0);
    clock.advanceMs(2 * MINUTE);
    expect(session.reclaim()).toBe(0);
  });

  it('keeps the session open while a step is pending', async () => {
    const clock = offsetClock(NOW);
    const session = createStudySession({ cards: deck(1), clock });

    await session.grade(0);
    // The queue is empty, but the sitting is paused, not finished — ending here
    // would tell the learner they were done moments before the card returns.
    expect(session.getState().endedAt).toBeNull();
  });

  it('caps how many times one card can come back', async () => {
    const clock = offsetClock(NOW);
    const session = createStudySession({
      cards: deck(1),
      config: { maxReclaimsPerCard: 2 },
      clock,
    });

    await session.grade(0);
    for (let i = 0; i < 5; i++) {
      clock.advanceMs(11 * MINUTE);
      if (session.reclaim() > 0) await session.grade(0);
    }

    clock.advanceMs(11 * MINUTE);
    // A session that never ends is how a learner discovers the quit button.
    expect(session.reclaim()).toBe(0);
  });

  it('can be turned off', async () => {
    const clock = offsetClock(NOW);
    const session = createStudySession({
      cards: deck(1),
      config: { reclaimRelearning: false },
      clock,
    });

    await session.grade(0);
    clock.advanceMs(60 * MINUTE);
    expect(session.reclaim()).toBe(0);
  });
});

describe('queue ordering', () => {
  it('puts relearning cards ahead of ordinary reviews', () => {
    const relearning = createCard({ question: 'r', answer: 'r' }, NOW);
    relearning.scheduling.status = 'relearning';
    relearning.scheduling.dueAt = NOW;

    const review = createCard({ question: 'v', answer: 'v' }, NOW - 1000);
    review.scheduling.status = 'review';
    review.scheduling.dueAt = NOW - 10_000; // older, so normally first

    const queue = buildQueue({ cards: [review, relearning], now: NOW });
    expect(queue[0]).toBe(relearning.id);
  });
});

describe('resume', () => {
  it('restores the remaining queue in order', async () => {
    const cards = deck(5);
    const clock = offsetClock(NOW);
    const original = createStudySession({ cards, clock });

    await original.grade(4);
    await original.grade(4);
    const snapshot = JSON.parse(JSON.stringify(original.getState()));

    const resumed = resumeStudySession(snapshot, { cards, clock });
    expect(resumed.remaining()).toBe(3);
    expect(resumed.getCurrentCard()?.id).toBe(original.getCurrentCard()?.id);
  });

  it('keeps progress measured against the whole sitting', async () => {
    const cards = deck(4);
    const clock = offsetClock(NOW);
    const original = createStudySession({ cards, clock });
    await original.grade(4);
    await original.grade(4);

    const resumed = resumeStudySession(original.getState(), { cards, clock });
    // A resumed session restarting at 0% would erase the learner's sense of
    // having done the work.
    expect(resumed.progress()).toBeCloseTo(0.5, 2);
  });

  it('drops cards that no longer exist', async () => {
    const cards = deck(3);
    const clock = offsetClock(NOW);
    const snapshot = createStudySession({ cards, clock }).getState();

    const resumed = resumeStudySession(snapshot, { cards: cards.slice(0, 2), clock });
    expect(resumed.remaining()).toBe(2);
  });
});

describe('FSRS config validation', () => {
  it('rejects an FSRS-4.5 weight array instead of silently mixing defaults', () => {
    // Every formula reads `weights[n] ?? <FSRS-5 default>`, so a short array
    // was accepted and produced a scheduler that is neither algorithm.
    expect(() => createFSRSScheduler({ weights: Array(17).fill(1) })).toThrow(/17/);
    expect(() => createFSRSScheduler({ weights: Array(17).fill(1) })).toThrow(/FSRS-4\.5/);
  });

  it('rejects an out-of-range retention target', () => {
    expect(() => createFSRSScheduler({ desiredRetention: 1.5 })).toThrow(/desiredRetention/);
    expect(() => createFSRSScheduler({ desiredRetention: 0.1 })).toThrow(/desiredRetention/);
  });

  it('rejects non-finite weights', () => {
    const weights = [...DEFAULT_FSRS_CONFIG.weights];
    weights[3] = Number.NaN;
    expect(() => validateFSRSConfig({ ...DEFAULT_FSRS_CONFIG, weights })).toThrow(/index 3/);
  });

  it('accepts the defaults', () => {
    expect(() => validateFSRSConfig(DEFAULT_FSRS_CONFIG)).not.toThrow();
  });
});

describe('card validation', () => {
  it('refuses a card with no question or no answer', () => {
    expect(() => createCard({ question: '', answer: 'a' })).toThrow(/question/);
    expect(() => createCard({ question: 'q', answer: '   ' })).toThrow(/answer/);
  });
});

describe('applyLoadBalance', () => {
  it('applies moves and leaves untouched cards by reference', () => {
    const spike = Array.from({ length: 30 }, () => {
      const c = createCard({ question: 'q', answer: 'a' });
      c.scheduling.dueAt = NOW + 14 * 86_400_000;
      c.scheduling.interval = 14;
      c.scheduling.status = 'review';
      return c;
    });

    const moves = computeLoadBalance(spike, { now: NOW, targetPerDay: 5 });
    const balanced = applyLoadBalance(spike, moves, NOW);

    const changed = balanced.filter((c, i) => c !== spike[i]);
    expect(changed).toHaveLength(moves.length);
    // Identity is the cheap way to know what needs saving.
    expect(balanced.filter((c, i) => c === spike[i]).length).toBe(30 - moves.length);
  });

  it('is a no-op with no moves', () => {
    const cards = deck(2);
    expect(applyLoadBalance(cards, [])).toEqual(cards);
  });
});

describe('preview matches reality', () => {
  it('advertises the relearning step, not the raw FSRS interval', () => {
    const scheduler = createFSRSScheduler();
    const card = createCard({ question: 'q', answer: 'a' }, NOW);

    const preview = scheduler.preview(card, NOW);
    const actual = scheduler.grade(card, 0, { now: NOW }).card;

    // The Again button used to read "580m" while grading Again scheduled 10.
    // A label that disagrees with the outcome is worse than no label.
    expect(preview[0].intervalDays).toBeCloseTo(actual.scheduling.interval, 6);
    expect(preview[0].dueAt).toBe(actual.scheduling.dueAt);
  });

  it('agrees with the outcome for every grade', () => {
    const scheduler = createFSRSScheduler();
    const seeded = scheduler.grade(createCard({ question: 'q', answer: 'a' }, NOW), 4, {
      now: NOW,
    }).card;
    const at = seeded.scheduling.dueAt;
    const preview = scheduler.preview(seeded, at);

    for (const quality of [0, 1, 2, 3, 4, 5] as const) {
      const actual = scheduler.grade(seeded, quality, { now: at }).card;
      expect(preview[quality].intervalDays).toBeCloseTo(actual.scheduling.interval, 6);
      expect(preview[quality].dueAt).toBe(actual.scheduling.dueAt);
    }
  });
});
