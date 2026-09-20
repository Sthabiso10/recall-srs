/**
 * FSRS-6 behaviour, and the FSRS-5-era bugs it exposed.
 *
 * Each block here corresponds to one place this package disagreed with
 * `open-spaced-repetition/ts-fsrs` and `py-fsrs` (both MIT), which agree with
 * each other. `fsrs-conformance.test.ts` checks the whole model against the
 * reference numerically; this file names each individual trap so that a future
 * change that reintroduces one fails with an explanation rather than a diff of
 * 244 floating-point numbers.
 */

import {
  DEFAULT_FSRS_CONFIG,
  FSRS_5_DEFAULT_WEIGHTS,
  FSRS_6_DEFAULT_WEIGHTS,
  FSRS_MAX_STABILITY,
  FUZZ_MIN_INTERVAL_DAYS,
  applyFSRS,
  createCard,
  createFSRSScheduler,
  decayFactorFor,
  fuzzIntervalBanded,
  getFuzzRange,
  migrateWeights,
  nextDifficulty,
  retrievability,
  stabilityAfterLapse,
  stabilityShortTerm,
} from '../src/index';
import type { FSRSConfig, FSRSRating } from '../src/index';

const config: FSRSConfig = { ...DEFAULT_FSRS_CONFIG, weights: FSRS_6_DEFAULT_WEIGHTS };
const w = FSRS_6_DEFAULT_WEIGHTS;

const STABILITIES = [0.05, 0.2, 0.5, 1, 2.3, 5, 10, 50, 100, 500, 1000, 20000];
const DIFFICULTIES = [1, 1.5, 3, 5, 7, 9.5, 10];
const ELAPSED = [1, 2, 7, 30, 60, 365, 2000];

describe('post-lapse stability is capped below the pre-lapse value', () => {
  it('never exceeds S / e^(w17·w18), not merely S', () => {
    // The tempting cap is S itself — "forgetting cannot make a memory more
    // durable". That is true but too weak. With short-term scheduling on, the
    // most a lapse may leave behind is S / e^(w17·w18), which is strictly
    // below S. Capping at S instead lets a lapse on a weak, badly overdue card
    // hand back essentially all of its stability, rescheduling a card the
    // learner just failed almost as far out as if they had passed it.
    const cap = 1 / Math.exp((w[17] as number) * (w[18] as number));
    expect(cap).toBeLessThan(1);

    for (const S of STABILITIES) {
      for (const D of DIFFICULTIES) {
        for (const t of ELAPSED) {
          const r = retrievability(t, S, w);
          expect(stabilityAfterLapse(S, D, r, config)).toBeLessThanOrEqual(S * cap + 1e-12);
        }
      }
    }
  });

  it('degenerates to a cap of S when short-term scheduling is off', () => {
    // The reference's `enable_short_term: false` branch: w17 and w18 drop out.
    const longTermOnly: FSRSConfig = { ...config, shortTermThresholdDays: 0 };
    const S = 0.05;
    const r = retrievability(30, S, w);

    expect(stabilityAfterLapse(S, 1, r, longTermOnly)).toBeLessThanOrEqual(S);
    // ...and is strictly looser than the short-term-enabled cap for this card.
    expect(stabilityAfterLapse(S, 1, r, longTermOnly)).toBeGreaterThan(
      stabilityAfterLapse(S, 1, r, config),
    );
  });
});

describe('same-day reviews', () => {
  it('never shrink stability on a passing grade', () => {
    // sinc is clamped to at least 1 for Hard/Good/Easy. Without that clamp a
    // same-day Hard on a stable card *reduces* its stability — the learner
    // recalls the card and is punished for it.
    for (const S of STABILITIES) {
      for (const rating of [2, 3, 4] as FSRSRating[]) {
        expect(stabilityShortTerm(S, rating, config)).toBeGreaterThanOrEqual(S - 1e-12);
      }
    }
  });

  it('still shrink stability on Again', () => {
    expect(stabilityShortTerm(10, 1, config)).toBeLessThan(10);
  });

  it('give a smaller relative gain to an already-stable card (w19)', () => {
    // FSRS-5 multiplied a one-day card and a one-year card by the same factor
    // on a same-day repeat, which is not how re-reading works. w19 makes the
    // gain decay as S^(-w19).
    const gain = (S: number) => stabilityShortTerm(S, 3, config) / S;

    expect(w[19]).toBeGreaterThan(0);
    expect(gain(1000)).toBeLessThan(gain(1));
  });
});

describe('difficulty mean reversion', () => {
  it('reverts toward the unclamped D₀(Easy), not the clamped one', () => {
    // Under FSRS-5's weights D₀(4) ≈ 3.2 and clamping it to [1, 10] changed
    // nothing, so the distinction was invisible. Under FSRS-6's it is ≈ −4.77,
    // and clamping it to 1 puts the reversion target nearly six points too
    // high — every card in the collection drifts harder than it should.
    const w4 = w[4] as number;
    const w5 = w[5] as number;
    const w6 = w[6] as number;
    const w7 = w[7] as number;

    const rawBaseline = w4 - Math.exp(w5 * 3) + 1;
    expect(rawBaseline).toBeLessThan(0); // the whole reason this matters

    const D = 5;
    const rating: FSRSRating = 3;
    const delta = -w6 * (rating - 3);
    const damped = D + (delta * (10 - D)) / 9;

    expect(nextDifficulty(D, rating, config)).toBeCloseTo(
      w7 * rawBaseline + (1 - w7) * damped,
      10,
    );
  });

  it('still keeps the resulting difficulty inside [1, 10]', () => {
    let d = 5;
    for (let i = 0; i < 200; i++) d = nextDifficulty(d, 1, config);
    expect(d).toBeLessThanOrEqual(10);

    d = 5;
    for (let i = 0; i < 200; i++) d = nextDifficulty(d, 4, config);
    expect(d).toBeGreaterThanOrEqual(1);
  });
});

describe('stability bounds', () => {
  it('cannot run away to Infinity over a long successful history', () => {
    // Stability is *multiplied* on every recall. Without an upper clamp a
    // long-lived card overflows to Infinity and every interval it produces
    // afterwards is NaN — a card that silently disappears from the schedule.
    let memory = applyFSRS(null, 4, 0, config);
    for (let i = 0; i < 500; i++) {
      memory = applyFSRS(memory, 4, 3650, config);
    }

    expect(Number.isFinite(memory.stability)).toBe(true);
    expect(memory.stability).toBeLessThanOrEqual(FSRS_MAX_STABILITY);
  });
});

describe('weight migration', () => {
  it('turns a 19-weight FSRS-5 vector into one that still schedules as FSRS-5', () => {
    const migrated = migrateWeights(FSRS_5_DEFAULT_WEIGHTS);

    expect(migrated).toHaveLength(21);
    expect(migrated.slice(0, 19)).toEqual(Array.from(FSRS_5_DEFAULT_WEIGHTS));
    expect(migrated[19]).toBe(0); // S^0 = 1: no saturation, as in FSRS-5
    expect(migrated[20]).toBe(0.5); // FSRS-5's fixed decay

    // And the derived curve is FSRS-5's exactly.
    const { decay, factor } = decayFactorFor(migrated);
    expect(decay).toBe(-0.5);
    expect(factor).toBeCloseTo(19 / 81, 8);
  });

  it('re-expresses FSRS-4.5 difficulty parameters rather than copying them', () => {
    const v45 = Array.from({ length: 17 }, (_, i) => 0.5 + i * 0.1);
    const migrated = migrateWeights(v45);

    expect(migrated).toHaveLength(21);
    expect(migrated[4]).not.toBe(v45[4]); // w4 is a different quantity in 4.5
    expect(migrated.slice(17)).toEqual([0, 0, 0, 0.5]);
  });

  it('refuses a length that belongs to no FSRS version', () => {
    expect(() => migrateWeights(Array(20).fill(1))).toThrow(/20/);
  });

  it('keeps R(S, S) = 0.9 for every supported vector', () => {
    for (const weights of [
      FSRS_5_DEFAULT_WEIGHTS,
      FSRS_6_DEFAULT_WEIGHTS,
      migrateWeights(FSRS_5_DEFAULT_WEIGHTS),
    ]) {
      for (const S of [0.5, 7, 365]) {
        expect(retrievability(S, S, weights)).toBeCloseTo(0.9, 8);
      }
    }
  });
});

describe('banded fuzz', () => {
  const MAX = 36500;

  it('leaves short intervals alone', () => {
    // A ±15% nudge on a two-day interval can only move it to one or three
    // days. That is a 50% change dressed up as a nudge, so the reference skips
    // it — and so must relearning steps, which are fractions of a day.
    for (const ivl of [10 / (24 * 60), 0.5, 1, 2, 2.49]) {
      expect(fuzzIntervalBanded(ivl, 0, MAX, () => 0)).toBe(ivl);
      expect(fuzzIntervalBanded(ivl, 0, MAX, () => 0.999)).toBe(ivl);
    }
    expect(FUZZ_MIN_INTERVAL_DAYS).toBe(2.5);
  });

  it('widens the spread with the interval, but sub-linearly', () => {
    const spread = (ivl: number) => {
      const { minDays, maxDays } = getFuzzRange(ivl, 0, MAX);
      return maxDays - minDays;
    };

    expect(spread(5)).toBeLessThan(spread(30));
    expect(spread(30)).toBeLessThan(spread(365));
    // A flat ratio would make this equal; banded fuzz spends proportionally
    // less the longer the interval gets.
    expect(spread(365) / 365).toBeLessThan(spread(5) / 5);
  });

  it('stays inside its own range and under the maximum', () => {
    for (const ivl of [3, 10, 45, 400]) {
      const { minDays, maxDays } = getFuzzRange(ivl, 0, MAX);
      for (const roll of [0, 0.25, 0.5, 0.75, 0.9999]) {
        const fuzzed = fuzzIntervalBanded(ivl, 0, MAX, () => roll);
        expect(fuzzed).toBeGreaterThanOrEqual(minDays);
        expect(fuzzed).toBeLessThanOrEqual(maxDays);
        expect(fuzzed).toBeLessThanOrEqual(MAX);
      }
    }
  });

  it('never schedules a card earlier than it has already been waiting', () => {
    // A card sat 30 days and earns 32. Fuzzing it down to 29 would make it
    // instantly overdue — a nudge that only ever moves cards into the past.
    const { minDays } = getFuzzRange(32, 30, MAX);
    expect(minDays).toBeGreaterThanOrEqual(31);
  });

  it('respects the configured maximum interval', () => {
    const { maxDays } = getFuzzRange(300, 0, 310);
    expect(maxDays).toBeLessThanOrEqual(310);
  });

  it('is off by default, and opt-in per mode', () => {
    expect(DEFAULT_FSRS_CONFIG.fuzzMode).toBe('none');

    // A high ceiling, so the comparison is between two fuzz modes rather than
    // between two cards that both hit `maximumIntervalDays`.
    const opts = { maximumIntervalDays: 36500 };
    const banded = createFSRSScheduler({ ...opts, fuzzMode: 'banded', random: () => 0.95 });
    const none = createFSRSScheduler({ ...opts, fuzzMode: 'none' });

    const now = Date.parse('2026-01-01T09:00:00.000Z');
    const run = (s: ReturnType<typeof createFSRSScheduler>) => {
      let card = createCard({ question: 'q', answer: 'a' }, now);
      for (let i = 0; i < 4; i++) {
        card = s.grade(card, 5, { now: card.scheduling.dueAt }).card;
      }
      return card.scheduling.interval;
    };

    const plain = run(none);
    expect(plain).toBeLessThan(36500);
    expect(run(banded)).not.toBe(plain);
  });

  it('keeps honouring a bare intervalFuzzRatio, as configs used to set it', () => {
    // `intervalFuzzRatio` was the only fuzz control before `fuzzMode` existed.
    // Reading it literally now would switch those callers' jitter off without
    // saying so, so the mode is inferred when only the ratio is given.
    const legacy = createFSRSScheduler({ intervalFuzzRatio: 0.2 });
    expect(legacy.config.fuzzMode).toBe('ratio');

    // ...but an explicit mode always wins.
    const explicit = createFSRSScheduler({ intervalFuzzRatio: 0.2, fuzzMode: 'none' });
    expect(explicit.config.fuzzMode).toBe('none');
  });
});
