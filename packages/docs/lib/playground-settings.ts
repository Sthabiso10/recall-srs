/**
 * What the playground's controls hold, and how it survives a refresh.
 *
 * `offsetDays` is stored alongside the preferences because it describes the
 * data, not the UI: the cards on disk have already been shifted, so a reload
 * that forgot the offset would show a clock that silently disagrees with the
 * deck. See `demo-storage.ts`.
 */

import { DEFAULT_DECK, type DeckKey } from './playground-decks';

export interface PlaygroundSettings {
  deck: DeckKey;
  /** FSRS `desiredRetention`. Higher means shorter intervals and more reviews. */
  retention: number;
  /** `SessionConfig.limit`: cards per sitting. */
  limit: number;
  order: 'interleaved' | 'due-first' | 'new-first' | 'random';
  locale: string;
  /** Days the demo clock has been wound forward. */
  offsetDays: number;
}

export const DEFAULT_SETTINGS: PlaygroundSettings = {
  deck: DEFAULT_DECK,
  retention: 0.9,
  limit: 10,
  order: 'interleaved',
  locale: 'en',
  offsetDays: 0,
};

export const RETENTION_STEPS = [0.8, 0.85, 0.9, 0.95] as const;
export const LIMIT_STEPS = [5, 10, 20] as const;
export const ORDER_STEPS: Array<PlaygroundSettings['order']> = [
  'interleaved',
  'due-first',
  'random',
];

const KEY = 'recall-docs:playground-settings';

export function loadSettings(): PlaygroundSettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    // Spread over the defaults rather than trusting the blob: a settings shape
    // that gained a field since the visitor's last look must not render
    // `undefined` into a control.
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<PlaygroundSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: PlaygroundSettings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* Storage blocked. The playground works, it just forgets. */
  }
}
