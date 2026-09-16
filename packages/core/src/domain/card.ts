/**
 * Card factories and predicates.
 *
 * Constructing a `Card` by hand means getting seven scheduling fields right
 * every time. `createCard` is the only supported way in — it guarantees a card
 * always enters the system in a valid, immediately-reviewable state.
 */

import type {
  Card,
  CardId,
  NewCard,
  SchedulingState,
  Timestamp,
} from '../types/index';
import { DEFAULT_SCHEDULER_CONFIG } from '../algorithm/constants';
import { createId } from '../utils/id';

export function createCard<TMeta = Record<string, unknown>>(
  input: NewCard<TMeta>,
  now: Timestamp = Date.now(),
): Card<TMeta> {
  return {
    ...input,
    id: input.id ?? createId('card'),
    tags: input.tags ?? [],
    scheduling: freshSchedulingState(now),
    createdAt: now,
    updatedAt: now,
  } as Card<TMeta>;
}

/** Scheduling state for a never-seen card: due now, no history. */
export function freshSchedulingState(now: Timestamp = Date.now()): SchedulingState {
  return {
    repetitions: 0,
    easeFactor: DEFAULT_SCHEDULER_CONFIG.initialEaseFactor,
    interval: 0,
    dueAt: now,
    lastReviewedAt: null,
    lapses: 0,
    status: 'new',
  };
}

/**
 * Wipe a card's progress while keeping its content and id.
 * Use for "reset progress" buttons — never for editing question/answer text,
 * where the learner's existing schedule is usually still valid.
 */
export function resetCard<TMeta>(card: Card<TMeta>, now: Timestamp = Date.now()): Card<TMeta> {
  return { ...card, scheduling: freshSchedulingState(now), updatedAt: now };
}

export function suspendCard<TMeta>(card: Card<TMeta>, now: Timestamp = Date.now()): Card<TMeta> {
  return {
    ...card,
    scheduling: { ...card.scheduling, status: 'suspended' },
    updatedAt: now,
  };
}

/**
 * Bring a suspended card back. It returns as `new` when it has no history,
 * otherwise to `review` with its old interval intact.
 */
export function unsuspendCard<TMeta>(card: Card<TMeta>, now: Timestamp = Date.now()): Card<TMeta> {
  if (card.scheduling.status !== 'suspended') return card;
  return {
    ...card,
    scheduling: {
      ...card.scheduling,
      status: card.scheduling.repetitions === 0 ? 'new' : 'review',
    },
    updatedAt: now,
  };
}

/**
 * A "leech": a card that keeps lapsing no matter how often it comes back.
 * Surface these to the user — the fix is almost always rewriting the card, not
 * reviewing it harder.
 */
export function isLeech(card: Card, lapseThreshold = 8): boolean {
  return card.scheduling.lapses >= lapseThreshold;
}

export function hasTag(card: Card, tag: string): boolean {
  return card.tags.includes(tag);
}

export function matchesAnyTag(card: Card, tags: readonly string[]): boolean {
  return tags.length === 0 || tags.some((t) => card.tags.includes(t));
}

/** Index a card list by id, for O(1) lookup from a queue of ids. */
export function indexCards<TMeta>(cards: readonly Card<TMeta>[]): Map<CardId, Card<TMeta>> {
  return new Map(cards.map((card) => [card.id, card]));
}
