/**
 * The study session — one sitting, from first card to summary screen.
 *
 * Deliberately framework-free. `useStudySession()` in `@recall-srs/react` is a thin
 * wrapper that mirrors this object's state into React, which means the session
 * logic can be unit-tested with no DOM, and reused from a CLI, a Discord bot or
 * React Native without change.
 *
 * Persistence is the caller's job. The session emits updated cards and review
 * logs through `onReview`; whether they go to Supabase immediately, batch at the
 * end, or queue for offline sync is an app decision, not a library one.
 */

import type {
  Card,
  CardId,
  RecallQuality,
  ReviewLog,
  SessionConfig,
  SessionSummary,
  StudySessionState,
  Timestamp,
} from '../types/index';
import type { Clock } from '../ports/clock';
import { systemClock } from '../ports/clock';
import type { Scheduler } from '../algorithm/types';
import { createScheduler } from '../algorithm/scheduler';
import { indexCards } from '../domain/card';
import { createId } from '../utils/id';
import { buildQueue } from './queue';
import { summarizeSession } from '../stats/index';

export interface StudySessionOptions {
  cards: readonly Card[];
  config?: SessionConfig;
  scheduler?: Scheduler;
  clock?: Clock;
  /**
   * Called after every grade, before the queue advances. This is your save
   * hook — persist `card` and `log` here. Failures are the caller's to handle;
   * the session does not retry.
   */
  onReview?: (result: { card: Card; log: ReviewLog }) => void | Promise<void>;
  /** Called once when the last card is graded or `end()` is called. */
  onComplete?: (summary: SessionSummary) => void | Promise<void>;
}

export interface StudySession {
  /** Immutable snapshot of the current state. Safe to hand to React. */
  getState(): StudySessionState;
  /** The card being shown, or null when the queue is exhausted. */
  getCurrentCard(): Card | null;
  /** Flip to the answer side. Starts the response timer. */
  reveal(): void;
  /**
   * Grade the current card and advance.
   *
   * Throws if nothing is being shown — grading a card the learner has not seen
   * is a bug in the caller, and silently ignoring it hides it.
   */
  grade(quality: RecallQuality): Promise<{ card: Card; log: ReviewLog }>;
  /** Push the current card to the back of the queue without grading it. */
  skip(): void;
  /** Finish early. Idempotent; returns the same summary if already ended. */
  end(): Promise<SessionSummary>;
  /** Cards left, including the one on screen. */
  remaining(): number;
  /** Progress through the sitting, 0-1. */
  progress(): number;
}

export function createStudySession({
  cards,
  config = {},
  scheduler = createScheduler(),
  clock = systemClock,
  onReview,
  onComplete,
}: StudySessionOptions): StudySession {
  const index = indexCards(cards);
  const startedAt = clock.now();

  const state: StudySessionState = {
    id: createId('sess'),
    startedAt,
    endedAt: null,
    queue: buildQueue({ cards, config, now: startedAt }),
    completed: [],
    currentCardId: null,
    revealed: false,
    reviews: [],
  };
  state.currentCardId = state.queue[0] ?? null;

  const initialQueueSize = state.queue.length;
  /** When the current card was shown, for `durationMs` on the review log. */
  let shownAt: Timestamp = clock.now();
  let summary: SessionSummary | null = null;

  function getState(): StudySessionState {
    return { ...state, queue: [...state.queue], completed: [...state.completed], reviews: [...state.reviews] };
  }

  function getCurrentCard(): Card | null {
    if (!state.currentCardId) return null;
    return index.get(state.currentCardId) ?? null;
  }

  function advance(): void {
    state.queue.shift();
    state.currentCardId = state.queue[0] ?? null;
    state.revealed = false;
    shownAt = clock.now();
  }

  function reveal(): void {
    state.revealed = true;
  }

  async function grade(
    quality: RecallQuality,
  ): Promise<{ card: Card; log: ReviewLog }> {
    const card = getCurrentCard();
    if (!card) {
      throw new Error(
        'StudySession.grade() called with no current card. Check `remaining()` before grading.',
      );
    }

    const now = clock.now();
    const result = scheduler.grade(card, quality, {
      now,
      durationMs: Math.max(0, now - shownAt),
      sessionId: state.id,
    });

    // Keep the in-memory copy current so re-queued lapses reschedule from the
    // state they just reached, not the one they started the session with.
    index.set(card.id, result.card);
    state.reviews.push(result.log);
    state.completed.push(card.id);

    await onReview?.(result);

    const requeue = config.requeueLapses && result.log.lapsed;
    advance();
    if (requeue) {
      state.queue.push(card.id);
      state.currentCardId = state.queue[0] ?? null;
    }

    if (state.currentCardId === null) await end();
    return result;
  }

  function skip(): void {
    if (!state.currentCardId) return;
    const id: CardId = state.currentCardId;
    advance();
    state.queue.push(id);
    state.currentCardId = state.queue[0] ?? null;
  }

  async function end(): Promise<SessionSummary> {
    if (summary) return summary;
    state.endedAt = clock.now();
    summary = summarizeSession(state.id, state.startedAt, state.endedAt, state.reviews);
    await onComplete?.(summary);
    return summary;
  }

  function remaining(): number {
    return state.queue.length;
  }

  function progress(): number {
    if (initialQueueSize === 0) return 1;
    return Math.min(1, state.completed.length / initialQueueSize);
  }

  return { getState, getCurrentCard, reveal, grade, skip, end, remaining, progress };
}
