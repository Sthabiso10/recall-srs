/**
 * @recall-srs/adapter-localstorage
 *
 * The zero-setup backend. No account, no schema, no network — it is what makes
 * "npm install and study in five minutes" true, and it is the reference
 * implementation to read before writing your own adapter.
 *
 *   import { createLocalStorageAdapter } from '@recall-srs/adapter-localstorage';
 *   const adapter = createLocalStorageAdapter({ namespace: 'korean' });
 *
 * Know the limits before you ship it as your only backend:
 *   - ~5MB per origin, shared with everything else on the domain
 *   - synchronous, so very large decks block the main thread on read
 *   - per-browser, per-device: no sync, and a cleared cache loses everything
 *
 * Fine for a demo, a prototype, or a genuinely local-first app. For anything
 * with accounts, move to `@recall-srs/adapter-supabase` — the `StorageAdapter`
 * interface is the same, so it is a one-line swap in your provider.
 */

import {
  StorageError,
  type Card,
  type CardId,
  type CardQuery,
  type DeckId,
  type ReviewLog,
  type ReviewQuery,
  type StorageAdapter,
  type StudyDeck,
} from '@recall-srs/core';

export interface LocalStorageAdapterOptions {
  /** Key prefix, so several decks/users can share one origin. Default: 'recall'. */
  namespace?: string;
  /**
   * Storage implementation. Defaults to `window.localStorage`. Pass
   * `sessionStorage`, an in-memory shim for SSR, or a mock for tests.
   */
  storage?: StorageLike;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface Snapshot {
  version: number;
  cards: Record<CardId, Card>;
  decks: Record<DeckId, StudyDeck>;
  reviews: ReviewLog[];
}

const SCHEMA_VERSION = 1;

export function createLocalStorageAdapter(
  options: LocalStorageAdapterOptions = {},
): StorageAdapter {
  const namespace = options.namespace ?? 'recall';
  const storage = options.storage ?? getBrowserStorage();
  const key = `${namespace}:v${SCHEMA_VERSION}`;

  /**
   * Reads are cached in memory because localStorage is synchronous and gets hit
   * on every card render. The cache is invalidated on every write, so there is
   * one owner of truth per tab. Cross-tab sync would need a `storage` event
   * listener — out of scope here, but the hook point is obvious.
   */
  let cache: Snapshot | null = null;

  function read(): Snapshot {
    if (cache) return cache;
    try {
      const raw = storage.getItem(key);
      cache = raw ? (JSON.parse(raw) as Snapshot) : emptySnapshot();
    } catch (err) {
      // Corrupt JSON should not brick the app, but it must not pass silently
      // either — a learner deserves to know their progress did not load.
      throw new StorageError(`Could not read Recall data from key "${key}".`, err);
    }
    return cache;
  }

  function write(next: Snapshot): void {
    try {
      storage.setItem(key, JSON.stringify(next));
      cache = next;
    } catch (err) {
      // Most often QuotaExceededError. Name it: "storage full" is actionable,
      // "save failed" is not.
      throw new StorageError(
        'Could not write Recall data. Browser storage may be full or blocked (private mode).',
        err,
      );
    }
  }

  return {
    async init() {
      read();
    },

    /* --- cards ------------------------------------------------------- */

    async getCard(id) {
      return read().cards[id] ?? null;
    },

    async listCards(query: CardQuery = {}) {
      const all = Object.values(read().cards);
      const excludeSuspended = query.excludeSuspended ?? true;

      const filtered = all.filter((card) => {
        if (excludeSuspended && card.scheduling.status === 'suspended') return false;
        if (query.deckId && card.deckId !== query.deckId) return false;
        if (query.tags?.length && !query.tags.some((t) => card.tags.includes(t))) return false;
        if (query.categories?.length) {
          if (!card.category || !query.categories.includes(card.category)) return false;
        }
        if (query.dueBefore !== undefined && card.scheduling.dueAt > query.dueBefore) {
          return false;
        }
        return true;
      });

      filtered.sort((a, b) => a.scheduling.dueAt - b.scheduling.dueAt);

      const offset = query.offset ?? 0;
      return query.limit === undefined
        ? filtered.slice(offset)
        : filtered.slice(offset, offset + query.limit);
    },

    async saveCard(card) {
      const snap = read();
      write({ ...snap, cards: { ...snap.cards, [card.id]: card } });
    },

    async saveCards(cards) {
      const snap = read();
      const next = { ...snap.cards };
      for (const card of cards) next[card.id] = card;
      write({ ...snap, cards: next });
    },

    async deleteCard(id) {
      const snap = read();
      const next = { ...snap.cards };
      delete next[id];
      // Review logs are intentionally kept: they are history, and deleting a
      // card should not silently rewrite the learner's retention statistics.
      write({ ...snap, cards: next });
    },

    /* --- decks ------------------------------------------------------- */

    async getDeck(id) {
      return read().decks[id] ?? null;
    },

    async listDecks() {
      return Object.values(read().decks);
    },

    async saveDeck(deck) {
      const snap = read();
      write({ ...snap, decks: { ...snap.decks, [deck.id]: deck } });
    },

    async deleteDeck(id) {
      const snap = read();
      const decks = { ...snap.decks };
      delete decks[id];
      write({ ...snap, decks });
    },

    /* --- reviews (append-only) --------------------------------------- */

    async saveReview(log) {
      const snap = read();
      write({ ...snap, reviews: [...snap.reviews, log] });
    },

    async saveReviews(logs) {
      // One serialise instead of N. Matters here more than elsewhere:
      // localStorage writes are synchronous and block the main thread.
      const snap = read();
      write({ ...snap, reviews: [...snap.reviews, ...logs] });
    },

    async listReviews(query: ReviewQuery = {}) {
      const snap = read();
      const cardsById = snap.cards;

      let logs = snap.reviews;
      if (query.cardId) logs = logs.filter((l) => l.cardId === query.cardId);
      if (query.sessionId) logs = logs.filter((l) => l.sessionId === query.sessionId);
      if (query.deckId) {
        logs = logs.filter((l) => cardsById[l.cardId]?.deckId === query.deckId);
      }
      if (query.since !== undefined) logs = logs.filter((l) => l.reviewedAt >= query.since!);
      if (query.until !== undefined) logs = logs.filter((l) => l.reviewedAt <= query.until!);

      // Newest first — every consumer so far wants recent history.
      const sorted = [...logs].sort((a, b) => b.reviewedAt - a.reviewedAt);
      return query.limit ? sorted.slice(0, query.limit) : sorted;
    },
  };
}

function emptySnapshot(): Snapshot {
  return { version: SCHEMA_VERSION, cards: {}, decks: {}, reviews: [] };
}

/**
 * `localStorage` does not exist during SSR, and throws outright in some
 * privacy modes. Rather than crashing a Next.js render, fall back to a
 * throwaway in-memory store so the server pass renders an empty deck and the
 * client hydrates with the real data.
 */
function getBrowserStorage(): StorageLike {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const probe = '__recall_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch {
      // Safari private mode and similar: fall through to memory.
    }
  }
  return createMemoryStorage();
}

/** An in-memory `StorageLike`. Exported because it is genuinely useful in tests. */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
