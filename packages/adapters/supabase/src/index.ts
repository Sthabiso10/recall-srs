/**
 * @recall-srs/adapter-supabase
 *
 * Postgres-backed storage through the Supabase JS client.
 *
 *   import { createClient } from '@supabase/supabase-js';
 *   import { createSupabaseAdapter } from '@recall-srs/adapter-supabase';
 *
 *   const adapter = createSupabaseAdapter({ client: createClient(url, anonKey) });
 *
 * The adapter takes an already-configured client rather than a URL and key. It
 * must not own authentication: your app already has a session, and a second
 * client would fight it over token refresh. It also means the adapter never
 * touches your service-role key.
 *
 * Run `schema.sql` (next to this file) before first use. It creates the three
 * tables, the indexes the queries rely on, and row-level security policies
 * scoped to `auth.uid()`.
 *
 * TODO(you): implement the methods below. Each one carries the query it needs.
 */

import {
  StorageError,
  type Card,
  type CardQuery,
  type ReviewQuery,
  type StorageAdapter,
} from '@recall-srs/core';

/**
 * Structural type for the bits of `SupabaseClient` we use.
 *
 * Typed loosely on purpose: pinning `SupabaseClient<Database>` would force every
 * consumer onto one generated `Database` type and one SDK version. Swap in the
 * real type once you generate yours.
 */
export interface SupabaseClientLike {
  // The query builder is fluently chained and deeply generic; `any` here is the
  // price of not pinning every consumer to one generated `Database` type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
  auth: { getUser(): Promise<{ data: { user: { id: string } | null } }> };
}

export interface SupabaseAdapterOptions {
  client: SupabaseClientLike;
  /** Table name overrides, if your schema already uses these names. */
  tables?: {
    cards?: string;
    decks?: string;
    reviews?: string;
  };
  /**
   * Scope every row to one user. Omit it and the adapter reads the id from the
   * active session — which is what you want, so RLS and the client agree.
   */
  userId?: string;
}

const DEFAULT_TABLES = {
  cards: 'recall_cards',
  decks: 'recall_decks',
  reviews: 'recall_reviews',
} as const;

export function createSupabaseAdapter({
  client,
  tables,
  userId,
}: SupabaseAdapterOptions): StorageAdapter {
  const t = { ...DEFAULT_TABLES, ...tables };
  // Referenced by the TODO queries below; keep it until they are implemented.
  void t;

  /** Resolve the acting user once, lazily, then reuse it. */
  async function requireUserId(): Promise<string> {
    if (userId) return userId;
    const { data } = await client.auth.getUser();
    if (!data.user) {
      throw new StorageError(
        'No authenticated Supabase user. Sign in first, or pass `userId` explicitly.',
      );
    }
    return data.user.id;
  }

  return {
    async init() {
      // Fail fast and loudly: a missing table should surface here, at startup,
      // not as an empty deck three screens later.
      await requireUserId();
    },

    /* --- cards ------------------------------------------------------- */

    async getCard(id) {
      // TODO: .from(t.cards).select('*').eq('id', id).maybeSingle()
      //       then rowToCard(data).
      void id;
      throw new StorageError('getCard is not implemented yet.');
    },

    async listCards(query: CardQuery = {}) {
      // TODO: build the query conditionally —
      //   let q = client.from(t.cards).select('*').eq('user_id', await requireUserId());
      //   if (query.deckId)    q = q.eq('deck_id', query.deckId);
      //   if (query.tags)      q = q.overlaps('tags', query.tags);      // array overlap
      //   if (query.dueBefore) q = q.lte('due_at', new Date(query.dueBefore).toISOString());
      //   if (query.excludeSuspended ?? true) q = q.neq('status', 'suspended');
      //   q = q.order('due_at').limit(query.limit ?? 1000);
      void query;
      throw new StorageError('listCards is not implemented yet.');
    },

    async saveCard(card) {
      // TODO: .from(t.cards).upsert(cardToRow(card, userId), { onConflict: 'id' })
      void card;
      throw new StorageError('saveCard is not implemented yet.');
    },

    async saveCards(cards) {
      // TODO: one upsert with the whole array. Chunk at ~500 rows — larger
      // payloads start hitting statement timeouts on small instances.
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
      // TODO: plain .insert() — never upsert. Review logs are append-only.
      void log;
      throw new StorageError('saveReview is not implemented yet.');
    },

    async listReviews(query: ReviewQuery = {}) {
      // TODO: filter by card_id / session_id / reviewed_at range,
      //       order by reviewed_at desc.
      //
      // Once a user has tens of thousands of reviews, stop pulling them into
      // the browser for stats and add a Postgres function (or a materialised
      // view) that returns the aggregates directly.
      void query;
      throw new StorageError('listReviews is not implemented yet.');
    },
  };
}

/* ------------------------------------------------------------------ */
/* Row mapping                                                         */
/* ------------------------------------------------------------------ */

/**
 * Postgres row shape. Two conventions worth keeping:
 *   - snake_case columns, camelCase in TypeScript
 *   - timestamptz columns, epoch milliseconds in the domain model
 * Both conversions live here so nothing above this file knows about SQL.
 */
export interface CardRow {
  id: string;
  user_id: string;
  deck_id: string | null;
  question: string;
  answer: string;
  category: string | null;
  difficulty: string | null;
  tags: string[];
  repetitions: number;
  ease_factor: number;
  interval_days: number;
  due_at: string;
  last_reviewed_at: string | null;
  lapses: number;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function rowToCard(_row: CardRow): Card {
  // TODO: flatten the scheduling columns back into `scheduling`, and
  // `Date.parse` every timestamp.
  throw new StorageError('rowToCard is not implemented yet.');
}

export function cardToRow(_card: Card, _userId: string): CardRow {
  // TODO: the inverse. `new Date(ms).toISOString()` for timestamptz columns.
  throw new StorageError('cardToRow is not implemented yet.');
}
