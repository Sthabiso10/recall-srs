/**
 * Display helpers shared by the components.
 *
 * Kept out of `@recall-srs/core` on purpose: the core stays locale-free and
 * presentation-free, and anything a user reads belongs to the view layer where
 * an app can override or translate it.
 */

import type { RecallQuality } from '@recall-srs/core';

/**
 * Human-readable interval for a rating button: "10m", "1d", "3.5mo", "2y".
 * Rounds generously — nobody needs "1.03 days" on a button.
 */
export function formatInterval(days: number): string {
  if (days <= 0) return 'now';
  if (days < 1) {
    const minutes = Math.round(days * 24 * 60);
    return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;
  }
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${(days / 30).toFixed(days < 60 ? 1 : 0)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

/** 0.873 -> "87%". */
export function formatPercent(ratio: number, decimals = 0): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(decimals)}%`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

/**
 * Default rating labels.
 *
 * Six buttons is too many for most apps — presenting 0-5 makes learners
 * deliberate over a grade instead of answering honestly. The default UI shows
 * four (Again / Hard / Good / Easy) mapped onto 1/3/4/5; pass your own
 * `qualities` to `<RatingButtons>` if you want the full scale.
 */
export const QUALITY_LABELS: Record<RecallQuality, string> = {
  0: 'Blackout',
  1: 'Again',
  2: 'Wrong',
  3: 'Hard',
  4: 'Good',
  5: 'Easy',
};

/** The four-button default: Again / Hard / Good / Easy. */
export const DEFAULT_QUALITIES: RecallQuality[] = [1, 3, 4, 5];
