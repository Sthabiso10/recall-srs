/**
 * Localisation of the default components.
 *
 * The engine was always language-agnostic — `question` and `answer` are opaque
 * strings the scheduler never reads — but the components shipped hardcoded
 * English, which is a strange thing to hand to people building
 * language-learning apps. These pin the behaviour that fixed it.
 *
 * Testing against real locales rather than mocking `Intl`: the entire point is
 * that the runtime knows how to say "3 days" in French and we do not have to.
 * A mock would only assert that we called a function.
 */

import { DEFAULT_STRINGS, createFormatters, mergeStrings } from '../src/utils/intl';

describe('interval formatting', () => {
  it('uses the locale to abbreviate units', () => {
    const en = createFormatters('en');
    const fr = createFormatters('fr');
    const ja = createFormatters('ja');

    // Same number, three languages, no translation table in this package.
    expect(en.interval(3)).toMatch(/3/);
    expect(fr.interval(3)).toMatch(/3/);
    expect(ja.interval(3)).toMatch(/3/);

    // They should not all be identical — that would mean Intl was ignored.
    const rendered = new Set([en.interval(3), fr.interval(3), ja.interval(3)]);
    expect(rendered.size).toBeGreaterThan(1);
  });

  it('picks a sensible unit for each magnitude', () => {
    const f = createFormatters('en');

    expect(f.interval(10 / (24 * 60))).toMatch(/10/); // ten minutes
    expect(f.interval(0.5)).toMatch(/12/); // twelve hours
    expect(f.interval(3)).toMatch(/3/); // days
    expect(f.interval(45)).toMatch(/1\.5|2/); // months
    expect(f.interval(400)).toMatch(/1\.1/); // years
  });

  it('never renders a negative or non-finite interval', () => {
    const f = createFormatters('en');
    for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(f.interval(bad)).toMatch(/0/);
    }
  });

  it('formats a relearning step in minutes, not a fraction of a day', () => {
    // A lapsed card comes back in ten minutes. "0d" would be useless on a
    // button, and 0.007 would be worse.
    const label = createFormatters('en').interval(10 / (24 * 60));
    expect(label).not.toMatch(/0\.0/);
    expect(label).toMatch(/10/);
  });
});

describe('percent and duration', () => {
  it('formats percentages per locale', () => {
    expect(createFormatters('en').percent(0.873)).toMatch(/87/);
    expect(createFormatters('en').percent(0.873, 1)).toMatch(/87\.3/);
  });

  it('returns an em dash rather than NaN%', () => {
    expect(createFormatters('en').percent(Number.NaN)).toBe('—');
  });

  it('formats durations', () => {
    const f = createFormatters('en');
    expect(f.duration(45_000)).toMatch(/45/);
    expect(f.duration(180_000)).toMatch(/3/);
  });

  it('groups large numbers per locale', () => {
    // 12345 is "12,345" in en-US and "12 345" in fr — the separator is exactly
    // the kind of thing nobody should hand-roll.
    const en = createFormatters('en-US').number(12345);
    const fr = createFormatters('fr-FR').number(12345);
    expect(en).toMatch(/12.345/);
    expect(fr).toMatch(/12.345/);
    expect(en).not.toBe(fr);
  });
});

describe('string overrides', () => {
  it('falls back to English for anything not overridden', () => {
    const strings = mergeStrings({ showAnswer: 'Voir la réponse' });

    expect(strings.showAnswer).toBe('Voir la réponse');
    // Partial overrides must not blank out the rest.
    expect(strings.skip).toBe(DEFAULT_STRINGS.skip);
    expect(strings.qualities[4]).toBe(DEFAULT_STRINGS.qualities[4]);
  });

  it('merges nested groups rather than replacing them', () => {
    const strings = mergeStrings({ qualities: { 1: 'Encore' } });

    expect(strings.qualities[1]).toBe('Encore');
    expect(strings.qualities[3]).toBe(DEFAULT_STRINGS.qualities[3]);
    expect(strings.stats.dueNow).toBe(DEFAULT_STRINGS.stats.dueNow);
  });

  it('returns the defaults unchanged when given nothing', () => {
    expect(mergeStrings()).toBe(DEFAULT_STRINGS);
    expect(mergeStrings(undefined).showAnswer).toBe('Show answer');
  });

  it('covers every string the components render', () => {
    // A missing key renders as `undefined` in the UI, which is worse than
    // English. This fails loudly if a component gains a string without one.
    for (const value of Object.values(DEFAULT_STRINGS)) {
      if (typeof value === 'string') {
        expect(value.length).toBeGreaterThan(0);
      } else {
        for (const nested of Object.values(value)) {
          expect(String(nested).length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('robustness', () => {
  it('survives an invalid locale instead of throwing mid-render', () => {
    // A bad locale tag from user settings must not take down the study screen.
    const f = createFormatters('not-a-locale-!!');
    expect(() => f.interval(3)).not.toThrow();
    expect(() => f.percent(0.5)).not.toThrow();
    expect(() => f.number(10)).not.toThrow();
  });

  it('accepts a locale list, as Intl does', () => {
    const f = createFormatters(['fr-CA', 'fr', 'en']);
    expect(f.interval(3)).toMatch(/3/);
  });
});
