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
  createFSRSScheduler,
  type Card,
  type CardId,
  type DeckId,
  type ReviewLog,
  type Scheduler,
  type FSRSConfig,
  type StorageAdapter,
} from '@recall-srs/core';

export interface SRSContextValue {
  adapter: StorageAdapter;
  scheduler: Scheduler;
  deckId?: DeckId;

  /** All cards loaded for the active deck, keyed by id. */
  cards: Map<CardId, Card>;
  /**
   * True until the first load finishes, and again whenever `cards` does not
   * yet answer the deck being asked for. Render a skeleton, not an empty deck.
   */
  loading: boolean;
  /**
   * Increments once per completed load of the card set, and never on a grade.
   *
   * That distinction is the whole point. `cards` is a new Map after every
   * single review, so its identity cannot tell "the learner graded a card"
   * apart from "this is a different deck now". Anything holding state derived
   * from the card set, a built queue above all, has to rebuild on the second
   * and must not rebuild on the first. This is that signal. 0 means nothing
   * has been loaded yet.
   */
  cardsVersion: number;
  /** Last load/save failure, or null. Surfaced so apps can show a retry. */
  error: Error | null;

  /** Re-read cards from storage. Call after a bulk import. */
  refresh: () => Promise<void>;
  /** Persist an updated card and its review log, then update the cache. */
  commitReview: (card: Card, log: ReviewLog) => Promise<void>;
}

const SRSContext = createContext<SRSContextValue | null>(null);

/**
 * Shared empty map, so the "nothing loaded" identity is stable across renders
 * and never triggers a downstream rebuild on its own. Treat it as read-only:
 * it is handed to every provider that has not loaded yet.
 */
const NO_CARDS: Map<CardId, Card> = new Map();

/**
 * Cards, plus the two facts that make them interpretable: which deck they
 * answer, and how many loads deep we are. Kept in one state object because
 * they must never disagree. Three separate `useState` calls could be observed
 * half-updated, which is exactly the flash this exists to prevent.
 */
interface CardSnapshot {
  cards: Map<CardId, Card>;
  deckId: DeckId | undefined;
  /** 0 until the first load completes. */
  version: number;
}

export interface SRSProviderProps {
  children: ReactNode;
  /** Where cards live. See `@recall-srs/adapter-*` or implement `StorageAdapter`. */
  adapter: StorageAdapter;
  /** Scope every hook to one deck. Omit to work across all decks. */
  deckId?: DeckId;
  /**
   * The scheduling algorithm. Defaults to FSRS, tuned by `fsrsConfig`.
   *
   * Pass one explicitly to configure it yourself:
   *
   *   <SRSProvider adapter={adapter} scheduler={createFSRSScheduler({ desiredRetention: 0.9 })}>
   *
   * Build it outside the component (or memoise it). A new instance on every
   * render is harmless for scheduling — schedulers are stateless — but it
   * re-runs every downstream `useMemo` that depends on it.
   */
  scheduler?: Scheduler;
  /** Tunes the default FSRS scheduler. Ignored when `scheduler` is supplied. */
  fsrsConfig?: Partial<FSRSConfig>;
  /** Skip the initial load, e.g. while the user is still signed out. */
  autoLoad?: boolean;
}

export function SRSProvider({
  children,
  adapter,
  deckId,
  scheduler: providedScheduler,
  fsrsConfig,
  autoLoad = true,
}: SRSProviderProps) {
  const [snapshot, setSnapshot] = useState<CardSnapshot>(() => ({
    cards: NO_CARDS,
    deckId: undefined,
    version: 0,
  }));
  const [loadInFlight, setLoadInFlight] = useState(autoLoad);
  const [error, setError] = useState<Error | null>(null);

  // Config objects are usually written inline (`schedulerConfig={{ ... }}`), so
  // a new identity arrives on every render. Serialising it keeps the scheduler
  // stable without asking every consumer to memoise.
  const configKey = JSON.stringify(fsrsConfig ?? {});
  const scheduler = useMemo(
    () => providedScheduler ?? createFSRSScheduler(fsrsConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providedScheduler, configKey],
  );

  /** Guards against a slow first load resolving after a faster second one. */
  const loadId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++loadId.current;
    setLoadInFlight(true);
    setError(null);
    try {
      await adapter.init?.();
      const loaded = await adapter.listCards(deckId ? { deckId } : undefined);
      if (id !== loadId.current) return; // a newer load already won
      setSnapshot((prev) => ({
        cards: new Map(loaded.map((card) => [card.id, card])),
        deckId,
        // Bumped here and nowhere else: a load happened.
        version: prev.version + 1,
      }));
    } catch (err) {
      if (id !== loadId.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (id === loadId.current) setLoadInFlight(false);
    }
  }, [adapter, deckId]);

  useEffect(() => {
    if (autoLoad) void refresh();
  }, [autoLoad, refresh]);

  const commitReview = useCallback(
    async (card: Card, log: ReviewLog) => {
      // Optimistic: update the UI first so grading feels instant, then persist.
      // On failure we surface the error but keep the optimistic state, because
      // losing the learner's answer mid-session is worse than a stale row.
      //
      // `version` deliberately does not move. One card changed; the deck did
      // not, and a consumer that rebuilt here would reshuffle the queue under
      // the learner on every single grade.
      setSnapshot((prev) => ({
        ...prev,
        cards: new Map(prev.cards).set(card.id, card),
      }));
      try {
        await adapter.saveCard(card);
        await adapter.saveReview(log);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [adapter],
  );

  /*
   * `deckId` changes during render; the load that answers it finishes an
   * effect and a round trip later. In between, `snapshot` still holds the
   * previous deck's cards, and handing those out shows a card from the deck
   * the learner just navigated away from. So until the snapshot agrees with
   * the deck being asked for, this provider holds nothing and says it is
   * loading.
   *
   * `autoLoad: false` is the deliberate exception: nobody is coming to load
   * anything, so reporting a permanent spinner would be a lie.
   */
  const settled = snapshot.version > 0 && snapshot.deckId === deckId;
  const cards = settled ? snapshot.cards : NO_CARDS;
  const cardsVersion = settled ? snapshot.version : 0;
  const loading = loadInFlight || (autoLoad && !settled);

  const value = useMemo<SRSContextValue>(
    () => ({
      adapter,
      scheduler,
      ...(deckId ? { deckId } : {}),
      cards,
      cardsVersion,
      loading,
      error,
      refresh,
      commitReview,
    }),
    [
      adapter,
      scheduler,
      deckId,
      cards,
      cardsVersion,
      loading,
      error,
      refresh,
      commitReview,
    ],
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
