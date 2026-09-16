/**
 * Recall tables for Convex.
 *
 * Copy this into your own `convex/schema.ts`, or spread these tables into an
 * existing schema:
 *
 *   import { defineSchema } from 'convex/server';
 *   import { recallTables } from '@recall-srs/adapter-convex/convex/schema';
 *
 *   export default defineSchema({
 *     ...recallTables,
 *     yourOtherTable: defineTable({ ... }),
 *   });
 *
 * This file is NOT bundled into the package build — Convex compiles it in your
 * project, against your Convex version.
 *
 * Two notes:
 *   - Scheduling state is flattened into top-level fields, not nested, because
 *     Convex indexes fields by path and the due query is the hot one.
 *   - Timestamps are epoch milliseconds (`v.number()`), matching the domain
 *     model exactly. No conversion layer, unlike the Postgres adapter.
 */

import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const recallTables = {
  recallDecks: defineTable({
    deckId: v.string(),
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    settings: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_deck_id', ['deckId']),

  recallCards: defineTable({
    cardId: v.string(),
    userId: v.string(),
    deckId: v.optional(v.string()),

    question: v.string(),
    answer: v.string(),
    category: v.optional(v.string()),
    difficulty: v.optional(
      v.union(v.literal('easy'), v.literal('medium'), v.literal('hard')),
    ),
    tags: v.array(v.string()),

    // SM-2 scheduling state, flattened for indexing.
    repetitions: v.number(),
    easeFactor: v.number(),
    intervalDays: v.number(),
    dueAt: v.number(),
    lastReviewedAt: v.union(v.number(), v.null()),
    lapses: v.number(),
    status: v.union(
      v.literal('new'),
      v.literal('learning'),
      v.literal('review'),
      v.literal('relearning'),
      v.literal('suspended'),
    ),

    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    // The hot path: due cards for one user in one deck, soonest first.
    .index('by_user_deck_due', ['userId', 'deckId', 'dueAt'])
    .index('by_card_id', ['cardId'])
    .index('by_user_status', ['userId', 'status']),

  recallReviews: defineTable({
    reviewId: v.string(),
    userId: v.string(),
    cardId: v.string(),
    sessionId: v.optional(v.string()),

    quality: v.number(),
    reviewedAt: v.number(),
    durationMs: v.number(),
    lapsed: v.boolean(),

    // Snapshots either side of the review, so the retention curve can be
    // rebuilt from the log alone.
    previous: v.object({
      repetitions: v.number(),
      easeFactor: v.number(),
      interval: v.number(),
      status: v.string(),
    }),
    next: v.object({
      repetitions: v.number(),
      easeFactor: v.number(),
      interval: v.number(),
      status: v.string(),
    }),
  })
    .index('by_user_time', ['userId', 'reviewedAt'])
    .index('by_card', ['cardId', 'reviewedAt'])
    .index('by_session', ['sessionId']),
};

export default defineSchema(recallTables);
