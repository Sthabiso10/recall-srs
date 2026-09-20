/**
 * The learning ladder for new cards.
 *
 * FSRS alone would schedule a brand-new card rated Again about five hours out,
 * from w0. Five hours is the wrong answer to "I have never seen this and just
 * got it wrong": the learner is here now and the material is in working memory
 * now. The ladder puts short steps in front of the long-term curve, the way
 * Anki and the FSRS reference implementation both do.
 *
 * Grade semantics are ported from `open-spaced-repetition/ts-fsrs` (MIT)
 * `BasicLearningStepsStrategy`.
 */

import { DEFAULT_FSRS_CONFIG, createCard, createFSRSScheduler } from '../src/index';
import type { Card, RecallQuality } from '../src/index';
import { resolveStep } from '../src/algorithm/steps';

const NOW = Date.parse('2026-01-01T09:00:00.000Z');
const MINUTE = 60_000;

/** SM-2 qualities, since that is what `grade` takes. */
const AGAIN: RecallQuality = 0;
const HARD: RecallQuality = 3;
const GOOD: RecallQuality = 4;
const EASY: RecallQuality = 5;

function card(): Card {
  return createCard({ question: '물', answer: 'water' }, NOW);
}

const minutesBetween = (from: number, to: number) => (to - from) / MINUTE;

describe('defaults', () => {
  it('ships the reference ladder of one and ten minutes', () => {
    expect(DEFAULT_FSRS_CONFIG.learningStepsMinutes).toEqual([1, 10]);
  });
});

describe('a new card walks the ladder', () => {
  const scheduler = createFSRSScheduler();

  it('does not graduate on the first Good', () => {
    const graded = scheduler.grade(card(), GOOD, { now: NOW }).card;

    expect(graded.scheduling.status).toBe('learning');
    expect(graded.scheduling.learningStep).toBe(1);
    expect(minutesBetween(NOW, graded.scheduling.dueAt)).toBeCloseTo(10, 6);
  });

  it('graduates on the second Good, once the ladder runs out', () => {
    const first = scheduler.grade(card(), GOOD, { now: NOW }).card;
    const second = scheduler.grade(first, GOOD, { now: first.scheduling.dueAt }).card;

    expect(second.scheduling.status).toBe('review');
    expect(second.scheduling.interval).toBeGreaterThanOrEqual(1);
  });

  it('graduates immediately on Easy, wherever it is on the ladder', () => {
    const fromNew = scheduler.grade(card(), EASY, { now: NOW }).card;
    expect(fromNew.scheduling.status).toBe('review');

    const stepped = scheduler.grade(card(), AGAIN, { now: NOW }).card;
    const escaped = scheduler.grade(stepped, EASY, { now: stepped.scheduling.dueAt }).card;
    expect(escaped.scheduling.status).toBe('review');
  });

  it('sends Again back to the first step, in one minute, not five hours', () => {
    // Without the ladder this is w0 = 0.212 days ≈ 5 hours — long after the
    // learner has left, and the single worst moment to stop practising.
    const failed = scheduler.grade(card(), AGAIN, { now: NOW }).card;

    expect(failed.scheduling.status).toBe('learning');
    expect(failed.scheduling.learningStep).toBe(0);
    expect(minutesBetween(NOW, failed.scheduling.dueAt)).toBeCloseTo(1, 6);
  });

  it('drops a card back to the first step when it fails partway up', () => {
    const up = scheduler.grade(card(), GOOD, { now: NOW }).card;
    expect(up.scheduling.learningStep).toBe(1);

    const down = scheduler.grade(up, AGAIN, { now: up.scheduling.dueAt }).card;
    expect(down.scheduling.learningStep).toBe(0);
    expect(minutesBetween(up.scheduling.dueAt, down.scheduling.dueAt)).toBeCloseTo(1, 6);
  });

  it('holds position on Hard, at the midpoint of the first two steps', () => {
    // Hard needs an interval of its own. Reusing this step's would make it
    // indistinguishable from Again; reusing the next step's would make it Good.
    const held = scheduler.grade(card(), HARD, { now: NOW }).card;

    expect(held.scheduling.status).toBe('learning');
    expect(held.scheduling.learningStep).toBe(0);
    expect(minutesBetween(NOW, held.scheduling.dueAt)).toBeCloseTo(6, 6); // (1 + 10) / 2
  });

  it('uses 1.5x the only step for Hard when there is just one', () => {
    const single = createFSRSScheduler({ learningStepsMinutes: [10] });
    const held = single.grade(card(), HARD, { now: NOW }).card;

    expect(minutesBetween(NOW, held.scheduling.dueAt)).toBeCloseTo(15, 6);
  });
});

describe('lapses', () => {
  const scheduler = createFSRSScheduler();

  it('does not count a failed new card as a lapse', () => {
    // A lapse means "you knew this and forgot it". Failing a card you have
    // never recalled is learning, not forgetting. Counting it inflates every
    // lapse statistic and trips the leech threshold on cards nobody has
    // learned yet.
    const failed = scheduler.grade(card(), AGAIN, { now: NOW }).card;
    expect(failed.scheduling.lapses).toBe(0);

    const againAndAgain = scheduler.grade(failed, AGAIN, {
      now: failed.scheduling.dueAt,
    }).card;
    expect(againAndAgain.scheduling.lapses).toBe(0);
  });

  it('counts a failed review card as a lapse, exactly once', () => {
    const graduated = scheduler.grade(card(), EASY, { now: NOW }).card;
    expect(graduated.scheduling.status).toBe('review');

    const lapsed = scheduler.grade(graduated, AGAIN, {
      now: graduated.scheduling.dueAt,
    }).card;
    expect(lapsed.scheduling.lapses).toBe(1);

    // Walking the relearning ladder must not keep incrementing it.
    const stepped = scheduler.grade(lapsed, GOOD, { now: lapsed.scheduling.dueAt }).card;
    expect(stepped.scheduling.lapses).toBe(1);
  });
});

describe('turning the ladder off', () => {
  it('schedules a new card straight from FSRS when there are no steps', () => {
    const direct = createFSRSScheduler({ learningStepsMinutes: [] });
    const graded = direct.grade(card(), GOOD, { now: NOW }).card;

    expect(graded.scheduling.status).toBe('review');
    expect(graded.scheduling.learningStep).toBeUndefined();
    // w2 = 2.3065 days, and at 90% retention the interval is the stability.
    expect(graded.scheduling.interval).toBe(2);
  });

  it('leaves the relearning ladder alone', () => {
    const direct = createFSRSScheduler({ learningStepsMinutes: [] });
    const graduated = direct.grade(card(), EASY, { now: NOW }).card;
    const lapsed = direct.grade(graduated, AGAIN, { now: graduated.scheduling.dueAt }).card;

    expect(lapsed.scheduling.status).toBe('relearning');
  });
});

describe('previews agree with what grading actually does', () => {
  const scheduler = createFSRSScheduler();

  it('advertises ladder intervals, not curve intervals, for a new card', () => {
    const subject = card();
    const preview = scheduler.preview(subject, NOW);

    for (const quality of [AGAIN, HARD, GOOD, EASY]) {
      const actual = scheduler.grade(subject, quality, { now: NOW }).card;
      expect(preview[quality].intervalDays).toBeCloseTo(actual.scheduling.interval, 10);
      expect(preview[quality].dueAt).toBe(actual.scheduling.dueAt);
    }
  });
});

describe('resolveStep', () => {
  it('graduates everything when the ladder is empty', () => {
    for (const rating of [1, 2, 3, 4] as const) {
      expect(resolveStep([], 0, rating, false)).toBeNull();
      expect(resolveStep([], 0, rating, true)).toBeNull();
    }
  });

  it('only engages on Again for a review card', () => {
    expect(resolveStep([10], 0, 1, true)).toEqual({ minutes: 10, step: 0 });
    for (const rating of [2, 3, 4] as const) {
      expect(resolveStep([10], 0, rating, true)).toBeNull();
    }
  });

  it('graduates a card parked past the end of a shortened ladder', () => {
    // Someone edits their config from four steps to two; cards sitting on
    // step 3 must graduate rather than index into nothing.
    expect(resolveStep([1, 10], 3, 3, false)).toBeNull();
  });

  it('keeps sub-minute steps exact instead of rounding them to zero', () => {
    const outcome = resolveStep([0.2], 0, 2, false);
    expect(outcome?.minutes).toBeCloseTo(0.3, 10);
  });
});
