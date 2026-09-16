/**
 * Deck factories.
 *
 * A deck is metadata plus an ordered list of card ids — it never holds the
 * cards themselves. That keeps a 10,000-card deck cheap to load and lets
 * adapters page through cards without deserialising everything.
 */

import type { DeckSettings, NewDeck, StudyDeck, Timestamp } from '../types/index';
import { DEFAULT_DECK_SETTINGS } from '../algorithm/constants';
import { createId } from '../utils/id';

export function createDeck(input: NewDeck, now: Timestamp = Date.now()): StudyDeck {
  return {
    ...input,
    id: input.id ?? createId('deck'),
    cardIds: input.cardIds ?? [],
    settings: resolveDeckSettings(input.settings),
    createdAt: now,
    updatedAt: now,
  };
}

/** Fill in any unspecified deck settings from the defaults. */
export function resolveDeckSettings(settings?: Partial<DeckSettings>): DeckSettings {
  return { ...DEFAULT_DECK_SETTINGS, ...settings };
}
