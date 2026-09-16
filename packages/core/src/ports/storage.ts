/**
 * The storage port.
 *
 * This is the seam between Recall and your database. Every adapter in
 * `@recall-srs/adapter-*` implements this interface, and so can you — if you can
 * satisfy these ten methods against Postgres, Dexie, SQLite, an HTTP API or a
 * file on disk, Recall works on top of it unchanged.
 *
 * Design rules for implementers:
 *   1. Every method is async, even when your backend is synchronous. A
 *      localStorage adapter returning resolved promises costs nothing and keeps
 *      one code path in the React layer.
 *   2. `saveReview` must append. Review logs are immutable history; overwriting
 *      them destroys the data every analytics feature is derived from.
 *   3. Return plain data, never class instances. Everything must survive a
 *      structured clone and a JSON round-trip.
 *   4. Throw `StorageError` (or a subclass) on failure. Do not swallow errors
 *      and return empty arrays — a silent empty deck looks like "you finished!"
 *      to the learner.
 */

import type {
  Card,
  CardId,
  DeckId,
  ReviewLog,
  SessionId,
  StudyDeck,
  Timestamp,
} from '../types/index';

/** Filters accepted by `listCards`. All conditions are ANDed; arrays are ORed within themselves. */
export interface CardQuery {
  deckId?: DeckId;
  /** Only cards carrying at least one of these tags. */
  tags?: string[];
  categories?: string[];
  /** Only cards whose `dueAt` is at or before this timestamp. */
  dueBefore?: Timestamp;
  /** Exclude suspended cards. Defaults to true. */
  excludeSuspended?: boolean;
  limit?: number;
  offset?: number;
}

export interface ReviewQuery {
  cardId?: CardId;
  deckId?: DeckId;
  sessionId?: SessionId;
  since?: Timestamp;
  until?: Timestamp;
  limit?: number;
}

export interface StorageAdapter {
  /**
   * Optional one-time setup: open the IndexedDB connection, run a migration,
   * verify the table exists. Callers must await it before anything else.
   */
  init?(): Promise<void>;

  /* --- cards --------------------------------------------------------- */
  getCard(id: CardId): Promise<Card | null>;
  listCards(query?: CardQuery): Promise<Card[]>;
  /** Insert or replace. Implementations should upsert on `card.id`. */
  saveCard(card: Card): Promise<void>;
  /** Batch upsert. Prefer a single round trip over N calls to `saveCard`. */
  saveCards(cards: Card[]): Promise<void>;
  deleteCard(id: CardId): Promise<void>;

  /* --- decks --------------------------------------------------------- */
  getDeck(id: DeckId): Promise<StudyDeck | null>;
  listDecks(): Promise<StudyDeck[]>;
  saveDeck(deck: StudyDeck): Promise<void>;
  deleteDeck(id: DeckId): Promise<void>;

  /* --- review history (append-only) ---------------------------------- */
  saveReview(log: ReviewLog): Promise<void>;
  listReviews(query?: ReviewQuery): Promise<ReviewLog[]>;
}

/** Thrown by adapters so callers can distinguish storage failures from bugs. */
export class StorageError extends Error {
  override readonly name = 'StorageError';
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}
