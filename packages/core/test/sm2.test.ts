/**
 * The spec for the SM-2 math, written before the math.
 *
 * The `it.todo` entries are the behaviours `sm2.ts` still owes — turn each one
 * into a real assertion as you implement it. The active tests cover invariants
 * that must hold no matter how you tune the formula, so they should stay green
 * the whole way through.
 */

import { DEFAULT_SCHEDULER_CONFIG, createScheduler, createCard } from '../src/index';
import { nextEaseFactor } from '../src/algorithm/sm2';

const config = DEFAULT_SCHEDULER_CONFIG;
const NOW = Date.parse('2026-01-01T09:00:00.000Z');

describe('nextEaseFactor', () => {
  it('never drops below the configured floor', () => {
    // Ten consecutive blackouts must not push the card into a death spiral.
    let ef = config.initialEaseFactor;
    for (let i = 0; i < 10; i++) ef = nextEaseFactor(ef, 0, config);
    expect(ef).toBeGreaterThanOrEqual(config.minimumEaseFactor);
  });

  it.todo('raises the ease factor on a quality of 5');
  it.todo('leaves the ease factor roughly unchanged on a quality of 4');
  it.todo('lowers the ease factor on a quality of 3 or below');
});

describe('nextInterval', () => {
  it.todo('returns 1 day after the first successful review');
  it.todo('returns 6 days after the second successful review');
  it.todo('returns round(previousInterval * easeFactor) from the third onward');
  it.todo('never exceeds config.maximumIntervalDays');
});

describe('applySM2 via the scheduler', () => {
  const scheduler = createScheduler();

  it('resets repetitions and counts a lapse when the grade is below passing', () => {
    const card = createCard({ question: '물', answer: 'water' }, NOW);
    const { card: passed } = scheduler.grade(card, 5, { now: NOW });
    const { card: failed } = scheduler.grade(passed, 1, { now: NOW });

    expect(failed.scheduling.repetitions).toBe(0);
    expect(failed.scheduling.lapses).toBe(1);
  });

  it('increments repetitions on a passing grade', () => {
    const card = createCard({ question: '불', answer: 'fire' }, NOW);
    const { card: graded } = scheduler.grade(card, 4, { now: NOW });
    expect(graded.scheduling.repetitions).toBe(1);
  });

  it('leaves the input card untouched', () => {
    const card = createCard({ question: '산', answer: 'mountain' }, NOW);
    const before = JSON.stringify(card);
    scheduler.grade(card, 5, { now: NOW });
    expect(JSON.stringify(card)).toBe(before);
  });

  it('never schedules a suspended card', () => {
    const card = createCard({ question: '강', answer: 'river' }, NOW);
    const suspended = {
      ...card,
      scheduling: { ...card.scheduling, status: 'suspended' as const },
    };
    expect(scheduler.isDue(suspended, NOW)).toBe(false);
  });

  it('writes a review log with before and after snapshots', () => {
    const card = createCard({ question: '바다', answer: 'sea' }, NOW);
    const { log } = scheduler.grade(card, 5, { now: NOW, durationMs: 1_200 });

    expect(log.cardId).toBe(card.id);
    expect(log.quality).toBe(5);
    expect(log.durationMs).toBe(1_200);
    expect(log.lapsed).toBe(false);
    expect(log.previous.repetitions).toBe(0);
    expect(log.next.repetitions).toBe(1);
  });
});

describe('preview', () => {
  const scheduler = createScheduler();

  it('offers a projection for every quality, for rating-button labels', () => {
    const card = createCard({ question: '하늘', answer: 'sky' }, NOW);
    const preview = scheduler.preview(card, NOW);

    expect(Object.keys(preview)).toHaveLength(6);
    expect(preview[0].lapses).toBe(true);
    expect(preview[5].lapses).toBe(false);
    expect(preview[5].dueAt).toBeGreaterThanOrEqual(NOW);
  });
});
