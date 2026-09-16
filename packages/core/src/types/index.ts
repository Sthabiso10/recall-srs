/**
 * Recall — domain types.
 *
 * This file is the contract every other package speaks. `@recall-srs/react`,
 * `@recall-srs/adapter-*` and any custom backend depend on these shapes and nothing
 * else, which is what keeps the engine swappable.
 *
 * Nothing in here imports anything. Keep it that way.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export type CardId = string;
export type DeckId = string;
export type SessionId = string;
export type ReviewLogId = string;

/** Milliseconds since epoch. A number, so it survives JSON round-trips intact. */
export type Timestamp = number;

/**
 * SM-2 recall quality, 0-5, graded by the learner the moment the answer is revealed.
 *
 *   0 - total blackout
 *   1 - wrong, but the answer felt familiar
 *   2 - wrong, and it was on the tip of the tongue
 *   3 - correct, but only after serious effort
 *   4 - correct after hesitation
 *   5 - instant, perfect recall
 *
 * Anything below 3 is a lapse: the card resets and re-enters the learning queue.
 */
export type RecallQuality = 0 | 1 | 2 | 3 | 4 | 5;

/** The grade at which SM-2 considers a review successful. */
export const PASSING_QUALITY = 3;

/**
 * Author-assigned difficulty. Deliberately separate from `easeFactor`: this is
 * editorial metadata ("this card is hard"), while ease factor is what the
 * algorithm learned about *this learner* on *this card*. Use it for filtering
 * and ordering, never for scheduling math.
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Where a card sits in its lifecycle.
 *
 *   new        - never reviewed
 *   learning   - in the short-interval intro phase
 *   review     - graduated; intervals measured in days
 *   relearning - lapsed out of `review` and working its way back
 *   suspended  - pulled from all queues by the user
 */
export type CardStatus = 'new' | 'learning' | 'review' | 'relearning' | 'suspended';

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

/**
 * FSRS memory state, under the DSR (Difficulty, Stability, Retrievability) model.
 *
 * Only present on cards scheduled by FSRS, and only after their first review —
 * initial stability depends on that first grade, so a never-seen card has no
 * memory state to speak of.
 */
export interface MemoryState {
  /**
   * Stability: the number of days until recall probability decays to 90%.
   * This *is* the interval at the default retention target, which is why FSRS
   * needs no separate notion of "interval growth".
   */
  stability: number;
  /**
   * FSRS difficulty, 1-10. How intrinsically hard this card is for this
   * learner — the analogue of SM-2's ease factor, but inverted (higher is
   * harder) and bounded.
   *
   * Not to be confused with `Card.difficulty`, which is editorial metadata the
   * author sets. This one is learned from review history and nothing else.
   */
  difficulty: number;
}

/**
 * Everything the algorithm knows about one card's schedule.
 *
 * Split out from `Card` so scheduling functions can stay pure: they take a
 * `SchedulingState` and return a new one, never mutating the input.
 *
 * The shape is shared by both algorithms, which means a few fields are only
 * meaningful under one of them — `easeFactor` under SM-2, `memory` under FSRS.
 * That is deliberate: one card model means you can switch algorithms without a
 * data migration, at the cost of a couple of inert fields.
 */
export interface SchedulingState {
  /** Consecutive successful reviews. Resets to 0 on a lapse. */
  repetitions: number;
  /**
   * SM-2 ease factor. Starts at 2.5, floors at 1.3. Higher means longer intervals.
   * Ignored by FSRS, which derives intervals from `memory` instead.
   */
  easeFactor: number;
  /** Current interval in days. 0 for a card that has never graduated. */
  interval: number;
  /** When this card next becomes reviewable. */
  dueAt: Timestamp;
  /** Last time it was graded, or null if never. */
  lastReviewedAt: Timestamp | null;
  /** How many times this card has fallen back out of `review`. */
  lapses: number;
  status: CardStatus;
  /** FSRS memory state. Absent under SM-2, and before an FSRS card's first review. */
  memory?: MemoryState;
  /**
   * Index into the relearning step ladder, when `status` is `relearning`.
   *
   * A lapsed card does not go straight back onto the long-term curve — it works
   * through short steps (ten minutes by default) first, so the learner gets
   * another attempt while the material is still in mind. Absent otherwise.
   */
  learningStep?: number;
}

/**
 * A single flashcard.
 *
 * `question` and `answer` are plain strings by design — render them as
 * markdown, HTML, audio prompts or hangul, whatever the host app needs.
 * Anything app-specific (romanisation, audio URLs, mnemonic images) goes in
 * `metadata`, which adapters persist verbatim.
 */
export interface Card<TMeta = Record<string, unknown>> {
  id: CardId;
  question: string;
  answer: string;
  /** Optional grouping within a deck, e.g. "verbs", "TOPIK I", "kitchen". */
  category?: string;
  /** Editorial difficulty. See the `Difficulty` docblock — not scheduling input. */
  difficulty?: Difficulty;
  tags: string[];
  deckId?: DeckId;
  scheduling: SchedulingState;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Escape hatch for app-specific fields. */
  metadata?: TMeta;
}

/** Input shape for `createCard()`. Scheduling and timestamps are filled in for you. */
export type NewCard<TMeta = Record<string, unknown>> = Omit<
  Card<TMeta>,
  'id' | 'scheduling' | 'createdAt' | 'updatedAt' | 'tags'
> & {
  id?: CardId;
  tags?: string[];
};

/* ------------------------------------------------------------------ */
/* Deck                                                                */
/* ------------------------------------------------------------------ */

/** Per-deck limits and ordering. Merged over `DEFAULT_DECK_SETTINGS`. */
export interface DeckSettings {
  /** Cap on how many never-seen cards enter a session. */
  newCardsPerDay: number;
  /** Cap on due reviews per session. 0 means unlimited. */
  maxReviewsPerDay: number;
  /** How the queue interleaves new cards with due reviews. */
  order: 'due-first' | 'new-first' | 'interleaved' | 'random';
  /** Reviews scheduled within this many ms of now count as due (avoids "due in 4 minutes"). */
  dueFuzzMs: number;
}

export interface StudyDeck {
  id: DeckId;
  name: string;
  description?: string;
  cardIds: CardId[];
  settings: DeckSettings;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Input shape for `createDeck()`. */
export type NewDeck = Omit<
  StudyDeck,
  'id' | 'cardIds' | 'settings' | 'createdAt' | 'updatedAt'
> & {
  id?: DeckId;
  cardIds?: CardId[];
  settings?: Partial<DeckSettings>;
};

/* ------------------------------------------------------------------ */
/* Review history                                                      */
/* ------------------------------------------------------------------ */

/**
 * An append-only record of one graded review.
 *
 * Never mutate or delete these. Retention curves, forecasts and any future
 * algorithm (FSRS, a trained model) are all derived from this log — it is the
 * source of truth, and `SchedulingState` is just a cache of the latest entry.
 */
export interface ReviewLog {
  id: ReviewLogId;
  cardId: CardId;
  sessionId?: SessionId;
  quality: RecallQuality;
  reviewedAt: Timestamp;
  /** Time from card shown to grade submitted. Useful for spotting guessing. */
  durationMs: number;
  /** Scheduling snapshot *before* this review. */
  previous: SchedulingSnapshot;
  /** Scheduling snapshot *after* this review. */
  next: SchedulingSnapshot;
  /** True when `quality` is below `PASSING_QUALITY`. */
  lapsed: boolean;
}

export type SchedulingSnapshot = Pick<
  SchedulingState,
  'repetitions' | 'easeFactor' | 'interval' | 'status'
>;

/* ------------------------------------------------------------------ */
/* Study session                                                       */
/* ------------------------------------------------------------------ */

export interface SessionConfig {
  deckId?: DeckId;
  /** Hard cap on cards in this sitting. Wins over deck settings when smaller. */
  limit?: number;
  /** Only pull cards carrying at least one of these tags. */
  tags?: string[];
  /** Only pull cards in one of these categories. */
  categories?: string[];
  /** Re-show lapsed cards later in the same sitting instead of deferring them. */
  requeueLapses?: boolean;
  order?: DeckSettings['order'];
}

/** Snapshot of an in-flight session. `@recall-srs/react` mirrors this into component state. */
export interface StudySessionState {
  id: SessionId;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  /** Cards still to be shown, in order. Index 0 is the current card. */
  queue: CardId[];
  /** Cards graded so far this sitting. */
  completed: CardId[];
  currentCardId: CardId | null;
  /** Whether the answer side is showing. Drives the flip in `<StudyView>`. */
  revealed: boolean;
  reviews: ReviewLog[];
}

/** What `session.end()` returns — the data behind the "nice work" screen. */
export interface SessionSummary {
  sessionId: SessionId;
  startedAt: Timestamp;
  endedAt: Timestamp;
  durationMs: number;
  cardsReviewed: number;
  correct: number;
  lapsed: number;
  /** correct / cardsReviewed, 0-1. Returns 0 rather than NaN for an empty session. */
  accuracy: number;
  averageQuality: number;
  averageDurationMs: number;
}

/* ------------------------------------------------------------------ */
/* Statistics                                                          */
/* ------------------------------------------------------------------ */

export interface DeckStats {
  total: number;
  /** Card counts bucketed by status. */
  byStatus: Record<CardStatus, number>;
  dueNow: number;
  dueToday: number;

  /** SM-2 only. 0 under FSRS, which has no ease factor. */
  averageEaseFactor: number;
  /** FSRS only — mean days-to-90%-recall across cards with memory state. */
  averageStability: number;
  /** FSRS only — mean difficulty, 1-10. */
  averageDifficulty: number;

  /**
   * Share of *mature* reviews graded at or above `PASSING_QUALITY`, 0-1.
   * Young cards are excluded because their high pass rate would flatter the
   * number without meaning anything. See `matureReviewCount` for the sample.
   */
  retentionRate: number;
  /** How many reviews the retention rate is computed from. */
  matureReviewCount: number;

  /** Consecutive days with at least one review, counting back from today. */
  streakDays: number;
}

/** One point on the "how much do I still remember N days out" curve. */
export interface RetentionPoint {
  /** Days between this review and the one before it. */
  intervalDays: number;
  reviewCount: number;
  /** Share recalled successfully at that interval, 0-1. */
  retention: number;
}

/** One bar in the upcoming-workload chart. */
export interface ForecastPoint {
  /** Days from today. 0 is today. */
  dayOffset: number;
  date: Timestamp;
  dueCount: number;
}
