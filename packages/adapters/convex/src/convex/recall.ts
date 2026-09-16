/**
 * Recall server functions for Convex.
 *
 * Copy this into your `convex/recall.ts`. Convex generates the typed `api`
 * object from it, which you then hand to `createConvexAdapter`.
 *
 * Not bundled into the package build — Convex compiles it in your project.
 *
 * ── Identity ────────────────────────────────────────────────────────────
 *
 * Every function resolves the user from `ctx.auth.getUserIdentity()` rather
 * than trusting a `userId` argument. A client-supplied user id is a request to
 * read someone else's cards, and these functions are the only place that can
 * refuse it.
 *
 * TODO(you): implement the bodies. The arg validators and indexes are done.
 */

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/** Resolve the caller, or refuse. Used by every function below. */
async function requireUser(ctx: { auth: { getUserIdentity(): Promise<any> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated.');
  return identity.subject as string;
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

export const getCard = query({
  args: { cardId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    // TODO: withIndex('by_card_id', q => q.eq('cardId', args.cardId)).unique()
    //       then check doc.userId === userId before returning. A card that
    //       belongs to someone else is a 'not found', not a 'forbidden'.
    void userId;
    void args;
    return null;
  },
});

export const listCards = query({
  args: {
    deckId: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    categories: v.optional(v.array(v.string())),
    dueBefore: v.optional(v.number()),
    excludeSuspended: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    // TODO:
    //   let q = ctx.db.query('recallCards')
    //     .withIndex('by_user_deck_due', (ix) => {
    //       const scoped = ix.eq('userId', userId);
    //       const deckScoped = args.deckId ? scoped.eq('deckId', args.deckId) : scoped;
    //       return args.dueBefore ? deckScoped.lte('dueAt', args.dueBefore) : deckScoped;
    //     });
    //   const docs = await q.take(args.limit ?? 500);
    //   return docs.filter(...tags/categories/suspended...).map(docToCard);
    //
    // Tags cannot be indexed usefully here — filter them in memory *after* the
    // index has already narrowed to one user and deck, never before.
    void userId;
    void args;
    return [];
  },
});

export const saveCard = mutation({
  args: { card: v.any() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    // TODO: look up by cardId; patch if it exists, insert if not.
    // Always write `userId` from the identity, never from the payload.
    void userId;
    void args;
  },
});

export const saveCards = mutation({
  args: { cards: v.array(v.any()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    // TODO: loop and upsert. This whole mutation is one transaction, so a bulk
    // import either lands completely or not at all.
    void userId;
    void args;
  },
});

export const deleteCard = mutation({
  args: { cardId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    // TODO: delete the card, keep its reviews. History outlives the card.
    void userId;
    void args;
  },
});

/* ------------------------------------------------------------------ */
/* Decks                                                               */
/* ------------------------------------------------------------------ */

export const getDeck = query({
  args: { deckId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    void userId;
    void args;
    return null;
  },
});

export const listDecks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    void userId;
    return [];
  },
});

export const saveDeck = mutation({
  args: { deck: v.any() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    void userId;
    void args;
  },
});

export const deleteDeck = mutation({
  args: { deckId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    void userId;
    void args;
  },
});

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

export const saveReview = mutation({
  args: { log: v.any() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    // TODO: insert only. Never patch an existing review.
    void userId;
    void args;
  },
});

export const listReviews = query({
  args: {
    cardId: v.optional(v.string()),
    deckId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    // TODO: by_user_time index, newest first, `.take(args.limit ?? 1000)`.
    //
    // Once users accumulate real history, add a `computeStats` query that
    // aggregates server-side and returns the numbers, instead of shipping
    // every log to the browser for `computeDeckStats` to reduce.
    void userId;
    void args;
    return [];
  },
});

/* ------------------------------------------------------------------ */
/* The Convex-native bonus                                             */
/* ------------------------------------------------------------------ */

/**
 * TODO(you): `gradeCard` — update the card and append its review log in one
 * transaction.
 *
 * Worth having. Through the `StorageAdapter` interface, grading is two calls
 * (`saveCard`, then `saveReview`), and a connection dropped between them leaves
 * a rescheduled card with no history behind it. Convex mutations are
 * transactional, so one function makes that impossible:
 *
 *   export const gradeCard = mutation({
 *     args: { cardId: v.string(), quality: v.number(), durationMs: v.number() },
 *     handler: async (ctx, args) => {
 *       const userId = await requireUser(ctx);
 *       const doc = await findCard(ctx, userId, args.cardId);
 *       const { card, log } = scheduler.grade(docToCard(doc), args.quality, {
 *         durationMs: args.durationMs,
 *       });
 *       await ctx.db.patch(doc._id, cardToFields(card));
 *       await ctx.db.insert('recallReviews', logToFields(log, userId));
 *       return card;
 *     },
 *   });
 *
 * `@recall-srs/core` has no dependencies and runs fine in the Convex runtime, so
 * the scheduler can live server-side — which also stops a modified client from
 * writing itself an artificial schedule.
 */
