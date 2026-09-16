/**
 * The localStorage adapter is the one every new user touches first, and it was
 * the only "working" package with no tests at all. These cover the contract
 * every adapter owes `StorageAdapter`, so they also double as the checklist for
 * anyone implementing a new backend.
 */

import { createCard, createDeck, type Card, type ReviewLog } from '@recall-srs/core';
import { StorageError } from '@recall-srs/core';
import { createLocalStorageAdapter, createMemoryStorage } from '../src/index';

const NOW = Date.parse('2026-01-01T09:00:00.000Z');
const DAY = 86_400_000;

function adapter(storage = createMemoryStorage()) {
  return createLocalStorageAdapter({ namespace: 'test', storage });
}

function card(overrides: Partial<Card> = {}): Card {
  return { ...createCard({ question: 'q', answer: 'a', tags: ['korean'] }, NOW), ...overrides };
}

function log(cardId: string, overrides: Partial<ReviewLog> = {}): ReviewLog {
  return {
    id: 'rev_' + Math.random().toString(36).slice(2),
    cardId,
    quality: 4,
    reviewedAt: NOW,
    durationMs: 1000,
    previous: { repetitions: 0, easeFactor: 2.5, interval: 0, status: 'new' },
    next: { repetitions: 1, easeFactor: 2.5, interval: 1, status: 'review' },
    lapsed: false,
    ...overrides,
  };
}

describe('cards', () => {
  it('round-trips a card through storage', async () => {
    const a = adapter();
    const c = card();
    await a.saveCard(c);
    expect(await a.getCard(c.id)).toEqual(c);
  });

  it('returns null for an unknown card rather than throwing', async () => {
    expect(await adapter().getCard('nope')).toBeNull();
  });

  it('upserts on save rather than duplicating', async () => {
    const a = adapter();
    const c = card();
    await a.saveCard(c);
    await a.saveCard({ ...c, question: 'edited' });

    const all = await a.listCards();
    expect(all).toHaveLength(1);
    expect(all[0]?.question).toBe('edited');
  });

  it('saves in batch', async () => {
    const a = adapter();
    await a.saveCards([card(), card(), card()]);
    expect(await a.listCards()).toHaveLength(3);
  });

  it('deletes a card but keeps its review history', async () => {
    const a = adapter();
    const c = card();
    await a.saveCard(c);
    await a.saveReview(log(c.id));
    await a.deleteCard(c.id);

    expect(await a.getCard(c.id)).toBeNull();
    // History outlives the card: deleting a card must not silently rewrite
    // the learner's retention statistics.
    expect(await a.listReviews()).toHaveLength(1);
  });
});

describe('listCards filtering', () => {
  it('excludes suspended cards by default and includes them on request', async () => {
    const a = adapter();
    const normal = card();
    const suspended = card();
    suspended.scheduling.status = 'suspended';
    await a.saveCards([normal, suspended]);

    expect(await a.listCards()).toHaveLength(1);
    expect(await a.listCards({ excludeSuspended: false })).toHaveLength(2);
  });

  it('filters by deck, tag and category', async () => {
    const a = adapter();
    await a.saveCards([
      { ...card(), deckId: 'ko', tags: ['verb'], category: 'grammar' },
      { ...card(), deckId: 'es', tags: ['noun'], category: 'vocab' },
    ]);

    expect(await a.listCards({ deckId: 'ko' })).toHaveLength(1);
    expect(await a.listCards({ tags: ['noun'] })).toHaveLength(1);
    expect(await a.listCards({ categories: ['vocab'] })).toHaveLength(1);
    expect(await a.listCards({ tags: ['nope'] })).toHaveLength(0);
  });

  it('filters by due date and sorts soonest-first', async () => {
    const a = adapter();
    const soon = card();
    soon.scheduling.dueAt = NOW;
    const later = card();
    later.scheduling.dueAt = NOW + 10 * DAY;
    await a.saveCards([later, soon]);

    const due = await a.listCards({ dueBefore: NOW + DAY });
    expect(due).toHaveLength(1);
    expect((await a.listCards())[0]?.id).toBe(soon.id);
  });

  it('applies limit and offset', async () => {
    const a = adapter();
    await a.saveCards([card(), card(), card(), card()]);
    expect(await a.listCards({ limit: 2 })).toHaveLength(2);
    expect(await a.listCards({ offset: 3 })).toHaveLength(1);
  });
});

describe('decks', () => {
  it('round-trips and lists decks', async () => {
    const a = adapter();
    const deck = createDeck({ name: 'Korean 101' }, NOW);
    await a.saveDeck(deck);

    expect(await a.getDeck(deck.id)).toEqual(deck);
    expect(await a.listDecks()).toHaveLength(1);

    await a.deleteDeck(deck.id);
    expect(await a.listDecks()).toHaveLength(0);
  });
});

describe('reviews', () => {
  it('appends rather than overwriting', async () => {
    const a = adapter();
    await a.saveReview(log('c1'));
    await a.saveReview(log('c1'));
    expect(await a.listReviews()).toHaveLength(2);
  });

  it('appends in batch', async () => {
    const a = adapter();
    await a.saveReviews?.([log('c1'), log('c2'), log('c3')]);
    expect(await a.listReviews()).toHaveLength(3);
  });

  it('filters by card, session and time range', async () => {
    const a = adapter();
    await a.saveReviews?.([
      log('c1', { sessionId: 's1', reviewedAt: NOW }),
      log('c2', { sessionId: 's2', reviewedAt: NOW + DAY }),
    ]);

    expect(await a.listReviews({ cardId: 'c1' })).toHaveLength(1);
    expect(await a.listReviews({ sessionId: 's2' })).toHaveLength(1);
    expect(await a.listReviews({ since: NOW + DAY })).toHaveLength(1);
    expect(await a.listReviews({ until: NOW })).toHaveLength(1);
  });

  it('returns newest first', async () => {
    const a = adapter();
    await a.saveReviews?.([
      log('old', { reviewedAt: NOW }),
      log('new', { reviewedAt: NOW + DAY }),
    ]);
    expect((await a.listReviews())[0]?.cardId).toBe('new');
  });
});

describe('durability', () => {
  it('persists across adapter instances sharing one storage', async () => {
    const storage = createMemoryStorage();
    const c = card();
    await adapter(storage).saveCard(c);

    // A fresh adapter is what a page reload looks like.
    expect(await adapter(storage).getCard(c.id)).toEqual(c);
  });

  it('keeps namespaces isolated', async () => {
    const storage = createMemoryStorage();
    await createLocalStorageAdapter({ namespace: 'a', storage }).saveCard(card());
    const other = createLocalStorageAdapter({ namespace: 'b', storage });
    expect(await other.listCards()).toHaveLength(0);
  });

  it('throws StorageError on corrupt data instead of silently returning empty', async () => {
    const storage = createMemoryStorage();
    storage.setItem('test:v1', '{ not json');
    // An empty deck reads as "you're done!" to a learner. Failing loudly is
    // the only honest option.
    await expect(adapter(storage).listCards()).rejects.toThrow(StorageError);
  });

  it('throws StorageError when the quota is exceeded', async () => {
    const storage = {
      ...createMemoryStorage(),
      setItem() {
        throw new Error('QuotaExceededError');
      },
    };
    await expect(adapter(storage).saveCard(card())).rejects.toThrow(StorageError);
  });
});
