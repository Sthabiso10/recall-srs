/**
 * @recall-srs/adapter-firebase
 *
 * Firestore-backed storage.
 *
 *   import { getFirestore } from 'firebase/firestore';
 *   import { createFirebaseAdapter } from '@recall-srs/adapter-firebase';
 *
 *   const adapter = createFirebaseAdapter({ db: getFirestore(app), userId: user.uid });
 *
 * Collection layout (subcollections under the user, not top-level):
 *
 *   users/{userId}/recall_cards/{cardId}
 *   users/{userId}/recall_decks/{deckId}
 *   users/{userId}/recall_reviews/{reviewId}
 *
 * Subcollections keep the security rules trivial (`request.auth.uid == userId`)
 * and keep one user's queries off every other user's documents.
 *
 * Two Firestore-specific things to plan for, both in `firestore.rules` and
 * `firestore.indexes.json` beside this file:
 *   - compound queries need composite indexes; Firestore will not scan for you
 *   - reads are billed per document, so a stats screen that fetches every
 *     review log is a line item. Aggregate into a rollup document as history
 *     grows.
 *
 * TODO(you): implement the methods below.
 */

import {
  StorageError,
  type CardQuery,
  type ReviewQuery,
  type StorageAdapter,
} from '@recall-srs/core';

/**
 * Structural type for the Firestore instance. Loose on purpose so this package
 * does not pin a modular-SDK version for every consumer.
 */
export type FirestoreLike = unknown;

export interface FirebaseAdapterOptions {
  db: FirestoreLike;
  /** The signed-in user. Required: every document path is scoped to it. */
  userId: string;
  /** Root collection holding per-user documents. Default: 'users'. */
  rootCollection?: string;
}

export function createFirebaseAdapter({
  db,
  userId,
  rootCollection = 'users',
}: FirebaseAdapterOptions): StorageAdapter {
  if (!userId) {
    throw new StorageError('createFirebaseAdapter requires a userId.');
  }

  /** users/{uid}/{name} — every read and write goes through here. */
  const path = (name: string) => `${rootCollection}/${userId}/${name}`;
  void db;
  void path;

  return {
    async init() {
      // Firestore needs no setup, but this is where you would call
      // `enableIndexedDbPersistence(db)` if you want offline support.
    },

    /* --- cards ------------------------------------------------------- */

    async getCard(id) {
      // TODO: getDoc(doc(db, path('recall_cards'), id)) -> docToCard
      void id;
      throw new StorageError('getCard is not implemented yet.');
    },

    async listCards(query: CardQuery = {}) {
      // TODO:
      //   const constraints = [];
      //   if (query.deckId)    constraints.push(where('deckId', '==', query.deckId));
      //   if (query.tags)      constraints.push(where('tags', 'array-contains-any', query.tags));
      //   if (query.dueBefore) constraints.push(where('scheduling.dueAt', '<=', query.dueBefore));
      //   constraints.push(orderBy('scheduling.dueAt'), limit(query.limit ?? 500));
      //
      // Note: `array-contains-any` caps at 30 values, and a range filter forces
      // the first orderBy onto the same field. Both will bite on the due query.
      void query;
      throw new StorageError('listCards is not implemented yet.');
    },

    async saveCard(card) {
      // TODO: setDoc(doc(db, path('recall_cards'), card.id), card, { merge: true })
      void card;
      throw new StorageError('saveCard is not implemented yet.');
    },

    async saveCards(cards) {
      // TODO: writeBatch(db). Firestore caps a batch at 500 operations —
      // chunk before committing.
      void cards;
      throw new StorageError('saveCards is not implemented yet.');
    },

    async deleteCard(id) {
      void id;
      throw new StorageError('deleteCard is not implemented yet.');
    },

    /* --- decks ------------------------------------------------------- */

    async getDeck(id) {
      void id;
      throw new StorageError('getDeck is not implemented yet.');
    },

    async listDecks() {
      throw new StorageError('listDecks is not implemented yet.');
    },

    async saveDeck(deck) {
      void deck;
      throw new StorageError('saveDeck is not implemented yet.');
    },

    async deleteDeck(id) {
      // TODO: Firestore does not cascade. Deleting a deck leaves its cards
      // orphaned unless you delete them too — do it in a batch.
      void id;
      throw new StorageError('deleteDeck is not implemented yet.');
    },

    /* --- reviews ----------------------------------------------------- */

    async saveReview(log) {
      // TODO: setDoc with log.id. Never merge into an existing review.
      void log;
      throw new StorageError('saveReview is not implemented yet.');
    },

    async listReviews(query: ReviewQuery = {}) {
      void query;
      throw new StorageError('listReviews is not implemented yet.');
    },
  };
}
