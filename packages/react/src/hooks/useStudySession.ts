'use client';

/**
 * `useStudySession()` — React bindings for `createStudySession` from the core.
 *
 * The session object is the source of truth; this hook mirrors it into state so
 * React re-renders, and persists each grade through the provider. All the
 * scheduling logic stays in `@recall-srs/core` where it can be tested without a DOM.
 *
 *   const { currentCard, revealed, reveal, grade, progress } = useStudySession({ limit: 20 });
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createStudySession,
  type Card,
  type RecallQuality,
  type SchedulePreview,
  type SessionConfig,
  type SessionSummary,
  type StudySession,
} from '@recall-srs/core';
import { useSRSContext } from '../context/SRSProvider';

export interface UseStudySessionResult {
  /** The card on screen, or null when the sitting is done. */
  currentCard: Card | null;
  /** Whether the answer side is showing. */
  revealed: boolean;
  /** Cards graded so far this sitting. */
  completed: number;
  /** Cards left, including the one on screen. */
  remaining: number;
  /** 0-1, for a progress bar. */
  progress: number;
  /** Non-null once the last card is graded or `end()` is called. */
  summary: SessionSummary | null;
  /** True while the session is being built from storage. */
  loading: boolean;

  reveal: () => void;
  grade: (quality: RecallQuality) => Promise<void>;
  skip: () => void;
  end: () => Promise<SessionSummary>;
  /** Discard the sitting and build a fresh queue from current cards. */
  restart: () => void;

  /**
   * What each grade would schedule, for rating-button labels ("1d", "4d",
   * "10m"). Recomputed per card; null when there is no current card.
   */
  preview: Record<RecallQuality, SchedulePreview> | null;
}

export function useStudySession(config: SessionConfig = {}): UseStudySessionResult {
  const { cards, scheduler, deckId, loading, commitReview } = useSRSContext();

  const [renderTick, forceRender] = useState(0);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [epoch, setEpoch] = useState(0);
  const sessionRef = useRef<StudySession | null>(null);

  // Serialised so an inline `{ limit: 20 }` config does not rebuild the session
  // on every render — which would reshuffle the queue mid-sitting.
  const configKey = JSON.stringify({ ...config, deckId });

  // Build once per (config, epoch). Deliberately NOT keyed on `cards`: the map
  // changes after every grade, and rebuilding then would restart the session
  // under the learner.
  const session = useMemo(() => {
    const created = createStudySession({
      cards: Array.from(cards.values()),
      config: { ...config, ...(deckId ? { deckId } : {}) },
      scheduler,
      onReview: ({ card, log }) => commitReview(card, log),
      onComplete: setSummary,
    });
    sessionRef.current = created;
    return created;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, epoch, scheduler, commitReview]);

  // Cards arrive asynchronously; rebuild once the first load lands so the
  // session is not stuck on an empty queue.
  const seeded = useRef(false);
  useEffect(() => {
    if (!loading && !seeded.current && cards.size > 0) {
      seeded.current = true;
      setEpoch((e) => e + 1);
    }
  }, [loading, cards.size]);

  const sync = useCallback(() => forceRender((n) => n + 1), []);

  const reveal = useCallback(() => {
    session.reveal();
    sync();
  }, [session, sync]);

  const grade = useCallback(
    async (quality: RecallQuality) => {
      await session.grade(quality);
      sync();
    },
    [session, sync],
  );

  const skip = useCallback(() => {
    session.skip();
    sync();
  }, [session, sync]);

  const end = useCallback(async () => {
    const result = await session.end();
    setSummary(result);
    sync();
    return result;
  }, [session, sync]);

  const restart = useCallback(() => {
    setSummary(null);
    setEpoch((e) => e + 1);
  }, []);

  // `renderTick` changes on every mutation, so these recompute exactly when the
  // session actually moves — not on every parent re-render. Before this, each
  // render allocated three arrays in getState() and ran applyFSRS six times in
  // preview(), and returned fresh object identities that broke memoisation in
  // every consumer downstream.
  const state = useMemo(
    () => session.getState(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, renderTick],
  );

  const currentCard = useMemo(
    () => session.getCurrentCard(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, renderTick],
  );

  const preview = useMemo(
    () => (currentCard ? scheduler.preview(currentCard) : null),
    [currentCard, scheduler],
  );

  return {
    currentCard,
    revealed: state.revealed,
    completed: state.completed.length,
    remaining: session.remaining(),
    progress: session.progress(),
    summary,
    loading,
    reveal,
    grade,
    skip,
    end,
    restart,
    preview,
  };
}
