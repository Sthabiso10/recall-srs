'use client';

/**
 * `useSRS()` — the general-purpose handle on the Recall context.
 *
 * Reach for it when you are building your own study UI instead of using
 * `<StudyView>`: it exposes the card cache, the scheduler, the adapter and the
 * CRUD helpers, and nothing about presentation.
 *
 *   const { cards, dueCards, addCard, grade } = useSRS();
 */

import { useCallback, useMemo } from 'react';
import {
  createCard as createCardEntity,
  type Card,
  type CardId,
  type NewCard,
  type RecallQuality,
} from '@recall-srs/core';
import { useSRSContext } from '../context/SRSProvider';

export interface UseSRSResult {
  /** Every loaded card, as an array. Memoised; safe in dependency arrays. */
  cards: Card[];
  /** Cards reviewable right now, soonest-due first. */
  dueCards: Card[];
  /** Cards never studied, oldest first. */
  newCards: Card[];
  loading: boolean;
  error: Error | null;

  getCard: (id: CardId) => Card | undefined;
  addCard: (input: NewCard) => Promise<Card>;
  updateCard: (card: Card) => Promise<void>;
  removeCard: (id: CardId) => Promise<void>;

  /**
   * Grade a card outside a session — for a quick-review widget, a "practice
   * this one" button, or a keyboard shortcut on a card list.
   */
  grade: (id: CardId, quality: RecallQuality, durationMs?: number) => Promise<Card>;

  refresh: () => Promise<void>;
}

export function useSRS(): UseSRSResult {
  const { adapter, scheduler, deckId, cards, loading, error, refresh, commitReview } =
    useSRSContext();

  const cardList = useMemo(() => Array.from(cards.values()), [cards]);

  const dueCards = useMemo(
    () =>
      cardList
        .filter((card) => scheduler.isDue(card))
        .sort((a, b) => a.scheduling.dueAt - b.scheduling.dueAt),
    [cardList, scheduler],
  );

  const newCards = useMemo(
    () =>
      cardList
        .filter((card) => card.scheduling.status === 'new')
        .sort((a, b) => a.createdAt - b.createdAt),
    [cardList],
  );

  const getCard = useCallback((id: CardId) => cards.get(id), [cards]);

  const addCard = useCallback(
    async (input: NewCard) => {
      const card = createCardEntity({ ...input, deckId: input.deckId ?? deckId });
      await adapter.saveCard(card);
      await refresh();
      return card;
    },
    [adapter, deckId, refresh],
  );

  const updateCard = useCallback(
    async (card: Card) => {
      await adapter.saveCard({ ...card, updatedAt: Date.now() });
      await refresh();
    },
    [adapter, refresh],
  );

  const removeCard = useCallback(
    async (id: CardId) => {
      await adapter.deleteCard(id);
      await refresh();
    },
    [adapter, refresh],
  );

  const grade = useCallback(
    async (id: CardId, quality: RecallQuality, durationMs = 0) => {
      const card = cards.get(id);
      if (!card) throw new Error(`useSRS.grade: no card with id "${id}"`);

      const { card: updated, log } = scheduler.grade(card, quality, { durationMs });
      await commitReview(updated, log);
      return updated;
    },
    [cards, scheduler, commitReview],
  );

  return {
    cards: cardList,
    dueCards,
    newCards,
    loading,
    error,
    getCard,
    addCard,
    updateCard,
    removeCard,
    grade,
    refresh,
  };
}
