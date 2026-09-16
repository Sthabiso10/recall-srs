/**
 * Standalone formatting helpers.
 *
 * These predate `<RecallIntl>` and stay for code that just wants to format a
 * number outside a component tree. They use the runtime's own locale, which in
 * a browser is the user's — so they are not English-only, they are simply not
 * *overridable*.
 *
 * Inside components, prefer `useRecallIntl().format`, which respects the
 * `locale` a `<RecallIntl>` provider sets. These call the same implementation.
 */

import type { RecallQuality } from '@recall-srs/core';
import { DEFAULT_STRINGS, createFormatters } from './intl';

const defaultFormatters = createFormatters(undefined);

/**
 * Human-readable interval for a rating button: "10m", "1d", "3.5mo", "2y",
 * localised to the runtime's locale.
 */
export function formatInterval(days: number): string {
  return defaultFormatters.interval(days);
}

/** 0.873 -> "87%", localised. */
export function formatPercent(ratio: number, decimals = 0): string {
  return defaultFormatters.percent(ratio, decimals);
}

/** Elapsed time for session summaries, localised. */
export function formatDuration(ms: number): string {
  return defaultFormatters.duration(ms);
}

/**
 * Default English rating labels.
 *
 * Kept as a named export for compatibility. To translate them, set them on a
 * `<RecallIntl strings={{ qualities: { ... } }}>` provider rather than reaching
 * for this — overriding a module-level constant will not reach the components.
 */
export const QUALITY_LABELS: Record<RecallQuality, string> = DEFAULT_STRINGS.qualities;

/**
 * The four-button default: Again / Hard / Good / Easy.
 *
 * Six grades is more precision than a learner can honestly supply, and under
 * FSRS 0, 1 and 2 all map to Again anyway — so showing six buttons offers three
 * that do exactly the same thing.
 */
export const DEFAULT_QUALITIES: RecallQuality[] = [1, 3, 4, 5];
