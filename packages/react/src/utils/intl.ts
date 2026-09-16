/**
 * Localised strings and number formatting.
 *
 * A spaced repetition library whose buttons only speak English is a strange
 * thing to hand to people building language-learning apps. The engine has
 * always been language-agnostic — `question` and `answer` are opaque strings
 * and the scheduler never looks at them — but the default components shipped
 * hardcoded English, so using them in French meant abandoning them for a render
 * prop.
 *
 * Everything here is pure, so it can be tested without a DOM.
 *
 * ── On formatting ───────────────────────────────────────────────────────
 *
 * Intervals use `Intl.NumberFormat` with `style: 'unit'` rather than string
 * concatenation. That is what turns 3 days into "3d" in English, "3 j" in
 * French and "3日" in Japanese without this package shipping a translation
 * table for every unit in every language. `Intl.RelativeTimeFormat` is the
 * tempting alternative and the wrong one — it produces "in 3 days", and a
 * rating button needs the quantity, not a sentence.
 */

import type { RecallQuality } from '@recall-srs/core';

/** Every user-visible string in the default components. */
export interface RecallStrings {
  /** Button that flips the card. */
  showAnswer: string;
  /** Defer the current card without grading it. */
  skip: string;
  /** Start a fresh sitting from the summary screen. */
  studyAgain: string;
  /** Shown while cards are loading. */
  loading: string;
  /** Shown when nothing is due. This is a good outcome — word it warmly. */
  nothingDue: string;
  /** Shown when the queue is drained but a relearning step is pending. */
  relearningWait: string;
  /** Accessible name for the progress bar. */
  progress: string;
  /** Accessible name for the rating button group. */
  rateYourRecall: string;
  /** Shown when the dashboard fails to load. */
  couldNotLoad: string;
  /** Retry button on that error. */
  retry: string;
  /** Dashboard stat captions. */
  stats: {
    dueNow: string;
    dueToday: string;
    totalCards: string;
    retention: string;
    streak: string;
  };
  /** Grade labels, 0-5. Most UIs only show 1, 3, 4 and 5. */
  qualities: Record<RecallQuality, string>;
}

export const DEFAULT_STRINGS: RecallStrings = {
  showAnswer: 'Show answer',
  skip: 'Skip',
  studyAgain: 'Study again',
  loading: 'Loading…',
  nothingDue: 'Nothing due right now. Come back later.',
  relearningWait: 'Nice work — one card comes back shortly.',
  progress: 'Session progress',
  rateYourRecall: 'Rate your recall',
  couldNotLoad: 'Could not load your progress.',
  retry: 'Retry',
  stats: {
    dueNow: 'Due now',
    dueToday: 'Due today',
    totalCards: 'Total cards',
    retention: 'Retention',
    streak: 'Streak',
  },
  qualities: {
    0: 'Blackout',
    1: 'Again',
    2: 'Wrong',
    3: 'Hard',
    4: 'Good',
    5: 'Easy',
  },
};

export interface RecallFormatters {
  /** "10m", "3d", "2mo", "1.2y" — localised. */
  interval(days: number): string;
  /** 0.873 -> "87%" — localised. */
  percent(ratio: number, decimals?: number): string;
  /** Elapsed time, for session summaries. */
  duration(ms: number): string;
  /** Plain integers, so thousands separators follow the locale. */
  number(value: number): string;
}

type UnitName = 'minute' | 'hour' | 'day' | 'month' | 'year';

/**
 * Build formatters for a locale.
 *
 * `locale` accepts anything `Intl` does, including undefined for the runtime
 * default — which is usually what you want, since the browser already knows
 * the user's preference.
 */
export function createFormatters(locale?: string | string[]): RecallFormatters {
  const unit = (value: number, name: UnitName, maximumFractionDigits = 0): string => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: name,
        unitDisplay: 'narrow',
        maximumFractionDigits,
      }).format(value);
    } catch {
      // `style: 'unit'` is ES2020 and missing in older engines (and some
      // React Native JSC builds). Degrading to an English-ish abbreviation
      // beats throwing inside a render.
      const suffix = { minute: 'm', hour: 'h', day: 'd', month: 'mo', year: 'y' }[name];
      return `${value.toFixed(maximumFractionDigits)}${suffix}`;
    }
  };

  return {
    interval(days) {
      if (!Number.isFinite(days) || days <= 0) return unit(0, 'minute');

      if (days < 1) {
        const minutes = Math.round(days * 24 * 60);
        return minutes < 60 ? unit(minutes, 'minute') : unit(Math.round(minutes / 60), 'hour');
      }
      if (days < 30) return unit(Math.round(days), 'day');
      if (days < 365) return unit(days / 30, 'month', days < 60 ? 1 : 0);
      return unit(days / 365, 'year', 1);
    },

    percent(ratio, decimals = 0) {
      if (!Number.isFinite(ratio)) return '—';
      try {
        return new Intl.NumberFormat(locale, {
          style: 'percent',
          maximumFractionDigits: decimals,
        }).format(ratio);
      } catch {
        return `${(ratio * 100).toFixed(decimals)}%`;
      }
    },

    duration(ms) {
      const seconds = Math.round(ms / 1000);
      if (seconds < 60) {
        try {
          return new Intl.NumberFormat(locale, {
            style: 'unit',
            unit: 'second',
            unitDisplay: 'narrow',
            maximumFractionDigits: 0,
          }).format(seconds);
        } catch {
          return `${seconds}s`;
        }
      }
      return unit(Math.round(seconds / 60), 'minute');
    },

    number(value) {
      try {
        return new Intl.NumberFormat(locale).format(value);
      } catch {
        return String(value);
      }
    },
  };
}

/** Deep-merge partial string overrides onto the defaults. */
export function mergeStrings(overrides?: DeepPartial<RecallStrings>): RecallStrings {
  if (!overrides) return DEFAULT_STRINGS;
  return {
    ...DEFAULT_STRINGS,
    ...overrides,
    stats: { ...DEFAULT_STRINGS.stats, ...overrides.stats },
    qualities: { ...DEFAULT_STRINGS.qualities, ...overrides.qualities },
  } as RecallStrings;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K];
};
