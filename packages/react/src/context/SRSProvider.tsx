'use client';

/**
 * `<SRSProvider>` — one place to configure storage, scheduler and deck.
 *
 * Wrap your app (or just the study route) once, and every hook below can find
 * the adapter without prop-drilling:
 *
 *   <SRSProvider adapter={createLocalStorageAdapter()} deckId="korean-101">
 *     <StudyView />
 *   </SRSProvider>
 *
 * The provider owns exactly two things: the configuration, and the in-memory
 * card cache. All scheduling lives in `@recall-srs/core` — this file should stay
 * boring.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  createScheduler,
  type Card,
  type CardId,
  type DeckId,
  type ReviewLog,
  type Scheduler,
  type SchedulerConfig,
  type StorageAdapter,
} from '@recall-srs/core';

export interface SRSContextValue {
  adapter: StorageAdapter;
  scheduler: Scheduler;
  deckId?: DeckId;

  /** All cards loaded for the active deck, keyed by id. */
  cards: Map<CardId, Card>;
  /** True until the first load finishes. Render a skeleton, not an empty deck. */
  loading: boolean;
  /** Last load/save failure, or null. Surfaced so apps can show a retry. */
  error: Error | null;

  /** Re-read cards from storage. Call after a bulk import. */
  refresh: () => Promise<void>;
  /** Persist an updated card and its review log, then update the cache. */
  commitReview: (card: Card, log: ReviewLog) => Promise<void>;
}

const SRSContext = createContext<SRSContextValue | null>(null);

export interface SRSProviderProps {
  children: ReactNode;
  /** Where cards live. See `@recall-srs/adapter-*` or implement `StorageAdapter`. */
  adapter: StorageAdapter;
  /** Scope every hook to one deck. Omit to work across all decks. */
  deckId?: DeckId;
  /**
   * The scheduling algorithm. Defaults to SM-2.
   *
   * Pass `createFSRSScheduler()` to run FSRS instead — no data migration
   * needed, since FSRS state lives in a field SM-2 ignores:
   *
   *   <SRSProvider adapter={adapter} scheduler={createFSRSScheduler({ desiredRetention: 0.9 })}>
   *
   * Build it outside the component (or memoise it). A new instance on every
   * render is harmless for scheduling — schedulers are stateless — but it
   * re-runs every downstream `useMemo` that depends on it.
   */
  scheduler?: Scheduler;
  /** Tunes the default SM-2 scheduler. Ignored when `scheduler` is supplied. */
  schedulerConfig?: Partial<SchedulerConfig>;
  /** Skip the initial load, e.g. while the user is still signed out. */
  autoLoad?: boolean;
}

export function SRSProvider({
  children,
  adapter,
  deckId,
  scheduler: providedScheduler,
  schedulerConfig,
  autoLoad = true,
}: SRSProviderProps) {
  const [cards, setCards] = useState<Map<CardId, Card>>(() => new Map());
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<Error | null>(null);

  // Config objects are usually written inline (`schedulerConfig={{ ... }}`), so
  // a new identity arrives on every render. Serialising it keeps the scheduler
  // stable without asking every consumer to memoise.
  const configKey = JSON.stringify(schedulerConfig ?? {});
  const scheduler = useMemo(
    () => providedScheduler ?? createScheduler(schedulerConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providedScheduler, configKey],
  );

  /** Guards against a slow first load resolving after a faster second one. */
  const loadId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++loadId.current;
    setLoading(true);
    setError(null);
    try {
      await adapter.init?.();
      const loaded = await adapter.listCards(deckId ? { deckId } : undefined);
      if (id !== loadId.current) return; // a newer load already won
      setCards(new Map(loaded.map((card) => [card.id, card])));
    } catch (err) {
      if (id !== loadId.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (id === loadId.current) setLoading(false);
    }
  }, [adapter, deckId]);

  useEffect(() => {
    if (autoLoad) void refresh();
  }, [autoLoad, refresh]);

  const commitReview = useCallback(
    async (card: Card, log: ReviewLog) => {
      // Optimistic: update the UI first so grading feels instant, then persist.
      // On failure we surface the error but keep the optimistic state — losing
      // the learner's answer mid-session is worse than a stale row.
      setCards((prev) => new Map(prev).set(card.id, card));
      try {
        await adapter.saveCard(card);
        await adapter.saveReview(log);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [adapter],
  );

  const value = useMemo<SRSContextValue>(
    () => ({
      adapter,
      scheduler,
      ...(deckId ? { deckId } : {}),
      cards,
      loading,
      error,
      refresh,
      commitReview,
    }),
    [adapter, scheduler, deckId, cards, loading, error, refresh, commitReview],
  );

  return <SRSContext.Provider value={value}>{children}</SRSContext.Provider>;
}

/** Internal accessor with a useful error message. Public entry point is `useSRS`. */
export function useSRSContext(): SRSContextValue {
  const ctx = useContext(SRSContext);
  if (!ctx) {
    throw new Error(
      'Recall hooks must be used inside <SRSProvider>. Wrap your study route in it.',
    );
  }
  return ctx;
}
