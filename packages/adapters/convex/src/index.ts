/**
 * @recall-srs/adapter-convex
 *
 * Convex is the odd one out among the adapters, and worth understanding before
 * you wire it up.
 *
 * The other backends are databases you query from the client. Convex is a
 * database *plus* a server function layer: you do not write queries from the
 * browser, you call deployed functions. So this package has two halves:
 *
 *   1. `src/convex/` — schema and function definitions you copy into your own
 *      `convex/` directory. Convex compiles and deploys them, and generates the
 *      typed `api` object from them.
 *   2. This file — a `StorageAdapter` that calls those functions through the
 *      Convex client.
 *
 *   import { ConvexReactClient } from 'convex/react';
 *   import { api } from '../convex/_generated/api';
 *   import { createConvexAdapter } from '@recall-srs/adapter-convex';
 *
 *   const adapter = createConvexAdapter({
 *     client: new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!),
 *     api: api.recall,
 *   });
 *
 * ── A note on reactivity ────────────────────────────────────────────────
 *
 * Convex's real advantage is live queries: `useQuery` re-renders when the data
 * changes, with no refetching. The `StorageAdapter` interface is request/response,
 * so going through it gives up that advantage — it works, and it is the right
 * first step, but a Convex-native integration would subscribe with `useQuery`
 * instead of polling `listCards`.
 *
 * `useConvexCards` at the bottom of this file sketches that path. Build it when
 * you want multi-device sync where a review on a phone updates an open laptop
 * tab immediately; that is the feature Convex buys you over Supabase.
 *
 * TODO(you): implement the methods below, and copy `src/convex/` into your app.
 */

import {
  StorageError,
  type CardQuery,
  type ReviewQuery,
  type StorageAdapter,
} from '@recall-srs/core';

/**
 * Structural types for the Convex client and the generated function
 * references. Typed loosely because the real `api` object is generated inside
 * the consumer's project — this package cannot import it.
 */
export interface ConvexClientLike {
  // Return types depend on the consumer's generated api, which this package
  // cannot see. Each method below narrows its own result instead.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  query(reference: unknown, args?: Record<string, unknown>): Promise<any>;
  mutation(reference: unknown, args?: Record<string, unknown>): Promise<any>;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** The function references from `api.recall` in your generated API. */
export interface ConvexRecallApi {
  getCard: unknown;
  listCards: unknown;
  saveCard: unknown;
  saveCards: unknown;
  deleteCard: unknown;
  getDeck: unknown;
  listDecks: unknown;
  saveDeck: unknown;
  deleteDeck: unknown;
  saveReview: unknown;
  listReviews: unknown;
}

export interface ConvexAdapterOptions {
  client: ConvexClientLike;
  /** `api.recall` from `convex/_generated/api`. */
  api: ConvexRecallApi;
  /**
   * Scope rows to one user. Usually omitted: the deployed functions should read
   * the identity from `ctx.auth.getUserIdentity()`, so the client cannot claim
   * to be someone else.
   */
  userId?: string;
}

export function createConvexAdapter({
  client,
  api,
  userId,
}: ConvexAdapterOptions): StorageAdapter {
  /** Merge the optional userId into every call without littering the methods. */
  const withUser = (args: Record<string, unknown> = {}) =>
    userId ? { ...args, userId } : args;

  // All three are referenced by the TODO calls below; keep them until the
  // methods are implemented.
  void client;
  void api;
  void withUser;

  return {
    async init() {
      // Nothing to set up: Convex manages schema and migrations at deploy time.
      // If `convex/schema.ts` is missing the recall tables, every call below
      // fails loudly, which is the behaviour you want.
    },

    /* --- cards ------------------------------------------------------- */

    async getCard(id) {
      // TODO: return client.query(api.getCard, withUser({ cardId: id }));
      void id;
      throw new StorageError('getCard is not implemented yet.');
    },

    async listCards(query: CardQuery = {}) {
      // TODO: return client.query(api.listCards, withUser({ ...query }));
      //
      // Do the filtering server-side in `convex/recall.ts`, not here. Convex
      // bills and rate-limits on documents read, so a query that pulls the deck
      // into the browser to filter it is the expensive way to be wrong.
      void query;
      throw new StorageError('listCards is not implemented yet.');
    },

    async saveCard(card) {
      // TODO: await client.mutation(api.saveCard, withUser({ card }));
      void card;
      throw new StorageError('saveCard is not implemented yet.');
    },

    async saveCards(cards) {
      // TODO: one mutation with the array. Convex mutations are transactional,
      // so a bulk import either lands completely or not at all — no partial
      // deck. Chunk very large imports to stay inside the function time limit.
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
      void id;
      throw new StorageError('deleteDeck is not implemented yet.');
    },

    /* --- reviews ----------------------------------------------------- */

    async saveReview(log) {
      // TODO: await client.mutation(api.saveReview, withUser({ log }));
      //
      // Worth doing in the same mutation as `saveCard`: Convex mutations are
      // transactions, so grading a card and recording its log can be made
      // atomic — something neither Supabase nor Firestore gives you for free.
      // See the `gradeCard` sketch in `src/convex/recall.ts`.
      void log;
      throw new StorageError('saveReview is not implemented yet.');
    },

    async listReviews(query: ReviewQuery = {}) {
      void query;
      throw new StorageError('listReviews is not implemented yet.');
    },
  };
}

/**
 * TODO(you): the Convex-native path.
 *
 * Rather than loading cards through `SRSProvider`, subscribe to them:
 *
 *   export function useConvexCards(deckId: string) {
 *     return useQuery(api.recall.listCards, { deckId }) ?? [];
 *   }
 *
 * That gives live updates across devices for free. It needs a provider variant
 * that accepts cards as a prop instead of loading them itself — a small change
 * to `SRSProvider`, and the reason its card cache is kept separate from its
 * adapter config.
 */
