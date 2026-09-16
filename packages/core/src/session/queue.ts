/**
 * Queue construction — deciding *which* cards a learner sees, and in what order.
 *
 * Underrated relative to the algorithm itself: SM-2 decides when a card is due,
 * but the queue decides whether today's sitting feels like 20 manageable cards
 * or 400 overwhelming ones. Most abandoned SRS apps died here, not in the math.
 */

import type { Card, CardId, DeckSettings, SessionConfig, Timestamp } from '../types/index';
import { matchesAnyTag } from '../domain/card';
import { DEFAULT_DECK_SETTINGS } from '../algorithm/constants';

export interface BuildQueueOptions {
  cards: readonly Card[];
  config?: SessionConfig;
  settings?: Partial<DeckSettings>;
  now?: Timestamp;
  /** Injectable for deterministic tests. Defaults to `Math.random`. */
  random?: () => number;
}

/**
 * Select and order the cards for one sitting.
 *
 * Steps:
 *   1. filter — deck, tags, categories; drop suspended cards
 *   2. split  — due reviews vs. new cards
 *   3. cap    — `maxReviewsPerDay` and `newCardsPerDay`, then the session `limit`
 *   4. order  — per `order`, defaulting to due-first
 *
 * Returns card ids rather than cards: the session holds ids, the React layer
 * holds the card map, and neither has to keep two copies in sync.
 */
export function buildQueue({
  cards,
  config = {},
  settings,
  now = Date.now(),
  random = Math.random,
}: BuildQueueOptions): CardId[] {
  const resolved: DeckSettings = { ...DEFAULT_DECK_SETTINGS, ...settings };
  const order = config.order ?? resolved.order;

  const eligible = cards.filter((card) => {
    if (card.scheduling.status === 'suspended') return false;
    if (config.deckId && card.deckId !== config.deckId) return false;
    if (config.tags?.length && !matchesAnyTag(card, config.tags)) return false;
    if (config.categories?.length) {
      if (!card.category || !config.categories.includes(card.category)) return false;
    }
    return true;
  });

  const isNew = (card: Card) => card.scheduling.status === 'new';
  const isDue = (card: Card) => card.scheduling.dueAt <= now + resolved.dueFuzzMs;

  // Oldest due first: the longer something has been waiting, the more likely
  // it is to be forgotten, so it earns the front of the line.
  const due = eligible
    .filter((c) => !isNew(c) && isDue(c))
    .sort((a, b) => a.scheduling.dueAt - b.scheduling.dueAt);

  const fresh = eligible.filter(isNew).sort((a, b) => a.createdAt - b.createdAt);

  const cappedDue =
    resolved.maxReviewsPerDay > 0 ? due.slice(0, resolved.maxReviewsPerDay) : due;
  const cappedNew = fresh.slice(0, Math.max(0, resolved.newCardsPerDay));

  const ordered = orderQueue(order, cappedDue, cappedNew, random);
  const limit = config.limit ?? ordered.length;
  return ordered.slice(0, limit).map((card) => card.id);
}

function orderQueue(
  order: DeckSettings['order'],
  due: readonly Card[],
  fresh: readonly Card[],
  random: () => number,
): Card[] {
  switch (order) {
    case 'due-first':
      return [...due, ...fresh];
    case 'new-first':
      return [...fresh, ...due];
    case 'interleaved':
      return interleave(due, fresh);
    case 'random':
      return shuffle([...due, ...fresh], random);
    default:
      return [...due, ...fresh];
  }
}

/**
 * Spread new cards evenly through the due ones, so a long review session gets
 * a steady trickle of novelty instead of a wall of new material at one end.
 */
function interleave(due: readonly Card[], fresh: readonly Card[]): Card[] {
  if (fresh.length === 0) return [...due];
  if (due.length === 0) return [...fresh];

  const out: Card[] = [];
  const gap = Math.max(1, Math.floor(due.length / fresh.length));
  let f = 0;

  due.forEach((card, i) => {
    out.push(card);
    if ((i + 1) % gap === 0 && f < fresh.length) {
      const next = fresh[f];
      if (next) out.push(next);
      f += 1;
    }
  });

  return [...out, ...fresh.slice(f)];
}

/** Fisher-Yates, with an injectable RNG so tests can pin the order. */
function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = items[i];
    const b = items[j];
    if (a !== undefined && b !== undefined) {
      items[i] = b;
      items[j] = a;
    }
  }
  return items;
}
