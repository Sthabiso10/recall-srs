/**
 * Regression tests for bugs found in review.
 *
 * Each of these shipped in 0.1.x and was caught by reading the code rather than
 * by a failing test — which is exactly why they are pinned here now.
 */

import {
  DEFAULT_FSRS_CONFIG,
  NotImplementedError,
  applyLeechPolicy,
  computeLoadBalance,
  computeRetentionCurve,
  computeStreak,
  createCard,
  createFSRSScheduler,
  createScheduler,
  createStudySession,
  intervalForRetention,
  offsetClock,
  startOfStudyDay,
} from '../src/index';
import type { Card, ReviewLog } from '../src/index';

const NOW = Date.parse('2026-01-01T09:00:00.000Z');
const DAY = 86_400_000;

function card(overrides: Partial<Card> = {}): Card {
  return { ...createCard({ question: 'q', answer: 'a' }, NOW), ...overrides };
}

describe('SM-2 refuses to run while unimplemented', () => {
  it('throws at construction rather than mis-scheduling silently', () => {
    // It used to return a fixed 1-day interval forever, with no error. A
    // learner would have seen every card every day and blamed their own code.
    expect(() => createScheduler()).toThrow(NotImplementedError);
  });

  it('names the working alternative in the error', () => {
    expect(() => createScheduler()).toThrow(/createFSRSScheduler/);
  });
});

describe('sub-day intervals', () => {
  it('lets a lapse return within the session instead of tomorrow', () => {
    // Floor used to be 1 day, so a card you just failed disappeared until the
    // next day — removing relearning entirely.
    const minutes = intervalForRetention(0.001, 0.9, 365, DEFAULT_FSRS_CONFIG.minimumIntervalDays);
    expect(minutes).toBeLessThan(1);
    expect(minutes).toBeGreaterThan(0);
  });

  it('schedules a lapsed card in minutes, not days', () => {
    const scheduler = createFSRSScheduler();
    const { card: seeded } = scheduler.grade(card(), 4, { now: NOW });
    const { card: lapsed } = scheduler.grade(seeded, 0, { now: NOW + 5 * DAY });

    const gapMs = lapsed.scheduling.dueAt - (NOW + 5 * DAY);
    expect(gapMs).toBeLessThan(DAY);
  });
});

describe('day-boundary anchoring', () => {
  it('anchors multi-day intervals to the start of the study day', () => {
    const lateNight = new Date('2026-01-01T23:40:00').getTime();
    const scheduler = createFSRSScheduler();
    // Easy, so the card graduates off the learning ladder in one grade and
    // actually earns a multi-day interval to anchor.
    const { card: graded } = scheduler.grade(card(), 5, { now: lateNight });

    // Studied at 23:40, the card must be available from the start of its due
    // day — not from 23:40, which would hide it during a morning session.
    const due = new Date(graded.scheduling.dueAt);
    expect(due.getHours()).toBe(DEFAULT_FSRS_CONFIG.dayStartsAtHour);
  });

  it('treats pre-rollover hours as the previous day', () => {
    const at2am = new Date('2026-01-02T02:00:00').getTime();
    const dayStart = new Date(startOfStudyDay(at2am, 4));
    expect(dayStart.getDate()).toBe(1);
  });
});

describe('session progress accounting', () => {
  it('does not report 100% while cards remain', async () => {
    const cards = [0, 1, 2].map((i) => createCard({ question: 'q' + i, answer: 'a' + i }));
    const session = createStudySession({
      cards,
      config: { requeueLapses: true },
      clock: offsetClock(NOW),
    });

    await session.grade(0);
    await session.grade(0);
    await session.grade(0);

    // Previously: completed.push() fired per grade event, so three lapses on a
    // three-card deck reported progress 1.00 with a full queue.
    expect(session.remaining()).toBeGreaterThan(0);
    expect(session.progress()).toBeLessThan(1);
  });
});

describe('suspended cards', () => {
  it('refuses to grade rather than emitting a phantom review log', () => {
    const scheduler = createFSRSScheduler();
    const suspended = card();
    suspended.scheduling.status = 'suspended';

    // It used to return the card unchanged but still write a ReviewLog, which
    // then polluted every retention statistic.
    expect(() => scheduler.grade(suspended, 5, { now: NOW })).toThrow(/suspended/i);
  });
});

describe('deterministic fuzz', () => {
  it('accepts an injected RNG so fuzzed scheduling is testable', () => {
    const scheduler = createFSRSScheduler({ intervalFuzzRatio: 0.2, random: () => 0.5 });
    const a = scheduler.grade(card(), 4, { now: NOW }).card.scheduling.dueAt;
    const b = scheduler.grade(card(), 4, { now: NOW }).card.scheduling.dueAt;
    expect(a).toBe(b);
  });
});

describe('native FSRS grading', () => {
  it('round-trips 1-4 ratings without the lossy 0-5 hop', () => {
    const scheduler = createFSRSScheduler();
    const viaRating = scheduler.gradeRating(card(), 4, { now: NOW });
    const viaQuality = scheduler.grade(card(), 5, { now: NOW });

    expect(viaRating.card.scheduling.interval).toBe(viaQuality.card.scheduling.interval);
    expect(viaRating.log.quality).toBe(5);
  });
});

describe('reconstructMemory', () => {
  it('recovers memory state by replaying history', () => {
    const scheduler = createFSRSScheduler();
    let c = card();
    const logs: ReviewLog[] = [];
    let at = NOW;

    for (let i = 0; i < 4; i++) {
      const r = scheduler.grade(c, 4, { now: at });
      c = r.card;
      logs.push(r.log);
      at = c.scheduling.dueAt;
    }

    const rebuilt = scheduler.reconstructMemory(logs);
    expect(rebuilt).not.toBeNull();
    // Replaying the same grades at the same times reproduces the live state.
    expect(rebuilt!.stability).toBeCloseTo(c.scheduling.memory!.stability, 4);
    expect(rebuilt!.difficulty).toBeCloseTo(c.scheduling.memory!.difficulty, 4);
  });

  it('returns null with no history', () => {
    expect(createFSRSScheduler().reconstructMemory([])).toBeNull();
  });
});

describe('leech policy', () => {
  it('tags a card that keeps lapsing', () => {
    const leech = card();
    leech.scheduling.lapses = 8;
    expect(applyLeechPolicy(leech).tags).toContain('leech');
  });

  it('can suspend instead, and is idempotent', () => {
    const leech = card();
    leech.scheduling.lapses = 10;
    const suspended = applyLeechPolicy(leech, { action: 'suspend' });
    expect(suspended.scheduling.status).toBe('suspended');
    expect(applyLeechPolicy(suspended, { action: 'suspend' })).toBe(suspended);
  });

  it('leaves healthy cards alone', () => {
    const healthy = card();
    expect(applyLeechPolicy(healthy)).toBe(healthy);
  });
});

describe('streaks', () => {
  it('counts consecutive days back from today', () => {
    const reviews = [0, 1, 2].map((d) => review(NOW - d * DAY));
    expect(computeStreak(reviews, NOW)).toBe(3);
  });

  it('does not break a streak just because today is unstudied', () => {
    // Otherwise every learner's streak reads zero each morning.
    const reviews = [1, 2].map((d) => review(NOW - d * DAY));
    expect(computeStreak(reviews, NOW)).toBe(2);
  });

  it('stops at a gap', () => {
    expect(computeStreak([review(NOW), review(NOW - 3 * DAY)], NOW)).toBe(1);
  });
});

describe('retention curve', () => {
  it('drops buckets with too few reviews to mean anything', () => {
    const sparse = [review(NOW, { previousInterval: 5 })];
    expect(computeRetentionCurve(sparse)).toHaveLength(0);
  });

  it('reports a pass rate per interval bucket', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      review(NOW - i * DAY, { previousInterval: 5, quality: i < 18 ? 4 : 1 }),
    );
    const curve = computeRetentionCurve(many);
    expect(curve).toHaveLength(1);
    expect(curve[0]!.retention).toBeCloseTo(0.9, 2);
  });
});

describe('load balancing', () => {
  it('moves cards off an overloaded day onto lighter neighbours', () => {
    // 40 cards all due on the same day, three weeks out.
    const spike = Array.from({ length: 40 }, () => {
      const c = card();
      c.scheduling.dueAt = NOW + 21 * DAY;
      c.scheduling.interval = 21;
      c.scheduling.status = 'review';
      return c;
    });

    const moves = computeLoadBalance(spike, { now: NOW, targetPerDay: 10, maxShiftDays: 2 });
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) expect(Math.abs(move.shiftDays)).toBeLessThanOrEqual(2);
  });

  it('never defers a card that is already due', () => {
    const overdue = card();
    overdue.scheduling.dueAt = NOW - DAY;
    expect(computeLoadBalance([overdue], { now: NOW, targetPerDay: 0 })).toHaveLength(0);
  });
});

function review(
  at: number,
  { previousInterval = 0, quality = 4 }: { previousInterval?: number; quality?: number } = {},
): ReviewLog {
  return {
    id: 'r' + at + Math.random(),
    cardId: 'c',
    quality: quality as ReviewLog['quality'],
    reviewedAt: at,
    durationMs: 0,
    previous: { repetitions: 1, easeFactor: 2.5, interval: previousInterval, status: 'review' },
    next: { repetitions: 2, easeFactor: 2.5, interval: previousInterval * 2, status: 'review' },
    lapsed: quality < 3,
  };
}

describe('relearning ladder', () => {
  const scheduler = createFSRSScheduler();

  /**
   * A card that has genuinely graduated into `review`.
   *
   * Easy, not Good: with learning steps a new card graded Good is still on the
   * *learning* ladder, and a card that fails there has not lapsed — it never
   * knew the material. Only a review card can lapse, which is what these tests
   * are about.
   */
  const reviewed = (s = scheduler, at = NOW) => s.grade(card(), 5, { now: at }).card;

  it('brings a lapsed card back in minutes, not tomorrow', () => {
    const seeded = reviewed();
    const at = seeded.scheduling.dueAt;
    const lapsed = scheduler.grade(seeded, 0, { now: at }).card;

    const minutes = (lapsed.scheduling.dueAt - at) / 60_000;
    // Lowering the interval floor alone was not enough: FSRS post-lapse
    // stability lands near a day, so the floor never engaged. The explicit
    // ladder is what actually keeps the card in the session.
    expect(minutes).toBeCloseTo(10, 0);
    expect(lapsed.scheduling.status).toBe('relearning');
    expect(lapsed.scheduling.learningStep).toBe(0);
  });

  it('graduates back onto the long-term curve after the ladder', () => {
    const seeded = reviewed();
    const lapsed = scheduler.grade(seeded, 0, { now: seeded.scheduling.dueAt }).card;
    const graduated = scheduler.grade(lapsed, 4, { now: lapsed.scheduling.dueAt }).card;

    expect(graduated.scheduling.status).toBe('review');
    expect(graduated.scheduling.learningStep).toBeUndefined();

    // Off the ladder means the interval came from the forgetting curve, not
    // from a relearning step. At the default 90% retention the interval *is*
    // the stability, rounded to whole days once past one — so asserting that
    // relationship pins "this came from FSRS" without hard-coding a number
    // that moves whenever the weights are re-fitted.
    const ladderDays = 10 / (24 * 60);
    expect(graduated.scheduling.interval).toBeGreaterThan(ladderDays);
    expect(graduated.scheduling.interval).toBe(
      Math.round(graduated.scheduling.memory!.stability),
    );
  });

  it('walks multiple steps in order', () => {
    const multi = createFSRSScheduler({ relearningStepsMinutes: [1, 10, 60] });
    const seeded = reviewed(multi);
    let c = multi.grade(seeded, 0, { now: seeded.scheduling.dueAt }).card;
    expect(c.scheduling.learningStep).toBe(0);

    c = multi.grade(c, 4, { now: c.scheduling.dueAt }).card;
    expect(c.scheduling.learningStep).toBe(1);

    c = multi.grade(c, 4, { now: c.scheduling.dueAt }).card;
    expect(c.scheduling.learningStep).toBe(2);

    c = multi.grade(c, 4, { now: c.scheduling.dueAt }).card;
    expect(c.scheduling.status).toBe('review');
  });

  it('counts the lapse exactly once, on entry', () => {
    const seeded = reviewed();
    const lapsed = scheduler.grade(seeded, 0, { now: seeded.scheduling.dueAt }).card;
    const stepped = scheduler.grade(lapsed, 4, { now: lapsed.scheduling.dueAt }).card;
    expect(stepped.scheduling.lapses).toBe(1);
  });

  it('can be disabled for apps that want straight rescheduling', () => {
    const noLadder = createFSRSScheduler({ relearningStepsMinutes: [] });
    const seeded = reviewed(noLadder);
    const lapsed = noLadder.grade(seeded, 0, { now: seeded.scheduling.dueAt }).card;
    expect(lapsed.scheduling.status).not.toBe('relearning');
  });
});
