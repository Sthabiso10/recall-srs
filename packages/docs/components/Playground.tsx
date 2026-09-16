'use client';

/**
 * The live demo, and the end-to-end smoke test for the whole stack.
 *
 * If this page works, the adapter, the provider, the session hook and the
 * components all work together. Break the library and this is the first thing
 * that shows it.
 *
 * It is written for one specific visitor: someone who arrived a minute ago and
 * wants to know whether this library is worth an afternoon. That shapes every
 * decision here:
 *
 *   1. Three decks, because a visitor who cannot honestly grade a card cannot
 *      see the scheduler differentiate (see `playground-decks.ts`).
 *   2. A time machine, because "come back tomorrow" is a dead end for someone
 *      evaluating in a browser tab, and the whole point of an SRS is what
 *      happens on day two.
 *   3. Live controls instead of a printed settings list, because every one of
 *      them is a real prop.
 *   4. The generated source underneath, because this is a library's
 *      playground, not an app.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createCard,
  createFSRSScheduler,
  type Card,
  type RecallQuality,
} from '@recall-srs/core';
import { ProgressDashboard, RecallIntl, SRSProvider, StudyView } from '@recall-srs/react';
import { createLocalStorageAdapter } from '@recall-srs/adapter-localstorage';
import type { StorageAdapter } from '@recall-srs/core';
import { GITHUB_URL } from '@/lib/nav';
import { ArrowUpRight } from './Icons';
import { PlaygroundCode } from './PlaygroundCode';
import { PlaygroundControls } from './PlaygroundControls';
import { travelForward, wipeDemoData } from '@/lib/demo-storage';
import { DECKS, deckFor, type DeckKey } from '@/lib/playground-decks';
import { localeFor } from '@/lib/playground-locales';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type PlaygroundSettings,
} from '@/lib/playground-settings';

const NAMESPACE = 'recall-docs';

/**
 * Guards the one-time seed against React StrictMode.
 *
 * In development StrictMode invokes effects twice. Both passes read an empty
 * deck before either has written, both seed it, and the deck ends up with two
 * of everything: the playground showed 16 cards for an 8-card deck. Keying the
 * promise on the storage generation makes the seed run once per *incarnation of
 * the data* no matter how many times the effect fires, which is the shape any
 * "seed on first run" effect needs once the data can be thrown away and rebuilt.
 */
let seededGeneration = -1;
let seedPromise: Promise<void> | null = null;

function seedAllDecks(adapter: StorageAdapter, generation: number): Promise<void> {
  if (seededGeneration !== generation || !seedPromise) {
    seededGeneration = generation;
    seedPromise = (async () => {
      await adapter.init?.();

      // All three decks up front. Seeding lazily on first visit to a deck would
      // make the tab switch stutter, and 24 cards is nothing.
      for (const deck of DECKS) {
        const existing = await adapter.listCards({ deckId: deck.id });
        if (existing.length > 0) continue;

        const cards: Card[] = deck.cards.map(({ question, answer, category }) =>
          createCard({
            question,
            answer,
            category,
            tags: [deck.tag],
            deckId: deck.id,
          }),
        );
        await adapter.saveCards(cards);
      }
    })();
  }
  return seedPromise;
}

export function Playground() {
  const [settings, setSettings] = useState<PlaygroundSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  /**
   * Bumped whenever the stored data is rewritten behind the adapter's back.
   * A new number means a new adapter, which means a fresh read. The adapter
   * caches its snapshot in memory, so nothing short of a new instance would
   * notice that the blob underneath it changed.
   */
  const [generation, setGeneration] = useState(0);
  const [ready, setReady] = useState(false);

  const adapter = useMemo(
    () => createLocalStorageAdapter({ namespace: NAMESPACE }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generation],
  );

  // Preferences are read after mount, never during render: this page is
  // statically exported, and reading localStorage in a render would make the
  // server's HTML and the client's first paint disagree.
  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveSettings(settings);
  }, [hydrated, settings]);

  /*
   * Note what this does *not* do: it never sets `ready` back to false. Winding
   * the clock bumps the generation, and re-showing the skeleton for the
   * microtask the re-seed takes would collapse the page to a third of its
   * height and throw the scroll position away: a flicker on every jump, on the
   * one control the page is built around. Only `reset` clears `ready`, because
   * only `reset` leaves the decks genuinely empty for a moment.
   */
  useEffect(() => {
    let cancelled = false;
    void seedAllDecks(adapter, generation).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, generation]);

  const patch = useCallback((next: Partial<PlaygroundSettings>) => {
    setSettings((current) => ({ ...current, ...next }));
  }, []);

  /**
   * Shifting timestamps is synchronous and writes nothing new, so the tree
   * stays mounted throughout. The keyed provider below re-reads, and the
   * learner sees the new day appear rather than a spinner.
   */
  const travel = useCallback((days: number) => {
    travelForward(NAMESPACE, days);
    setSettings((current) => ({
      ...current,
      offsetDays: current.offsetDays + days,
    }));
    setGeneration((value) => value + 1);
  }, []);

  /**
   * Reset is the one path that empties storage, so it *must* unmount the tree:
   * the provider and the re-seed would otherwise race, and a provider that
   * reads first shows an empty deck it will never reload.
   */
  const reset = useCallback(() => {
    wipeDemoData(NAMESPACE);
    setReady(false);
    setSettings((current) => ({ ...current, offsetDays: 0 }));
    setGeneration((value) => value + 1);
  }, []);

  if (!ready || !hydrated) {
    return (
      <div className="mt-8 flex min-h-[26rem] items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
        Preparing the decks…
      </div>
    );
  }

  const deck = deckFor(settings.deck);
  const locale = localeFor(settings.locale);

  return (
    <>
      <RecallIntl locale={locale.tag} strings={locale.strings}>
        {/*
          No `key` here on purpose. This used to remount the whole subtree on
          every deck switch to force a fresh queue, which worked and cost a
          400px collapse each time as the card and the dashboard fell back to
          their loading states. The provider now tracks its own loads, so the
          session rebuilds itself and the DOM stays put.
        */}
        <SRSProvider
          adapter={adapter}
          deckId={deck.id}
          fsrsConfig={{ desiredRetention: settings.retention }}
        >
          {/*
            The controls are a grid sibling of the card, not a child of the
            column it sits in, so that narrow screens get card then controls
            then dashboard. Nested the other way, a phone had to scroll past
            the entire dashboard to reach the time machine, which is the one
            control the page exists to show off.
          */}
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
            <div className="flex flex-col gap-4">
              <DeckTabs
                active={settings.deck}
                offsetDays={settings.offsetDays}
                onSelect={(key) => patch({ deck: key })}
              />
              <StudyPanel settings={settings} />
            </div>

            <PlaygroundControls
              settings={settings}
              onChange={patch}
              onTravel={travel}
              onReset={reset}
            />
          </div>

          <ProgressSection />
        </SRSProvider>
      </RecallIntl>

      <section className="mt-12">
        <p className="label">The code</p>
        <h2 className="mb-1 mt-1 text-xl font-medium">What this page is running</h2>
        <p className="mb-4 max-w-prose text-sm text-muted">
          Not an illustration. This updates as you change the controls, and it is the
          whole integration. Storage, scheduling and UI in one screen of code.
        </p>
        <PlaygroundCode settings={settings} namespace={NAMESPACE} />

        <a
          href={`${GITHUB_URL}/blob/main/packages/docs/components/Playground.tsx`}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
        >
          Read this page&apos;s own source
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </section>
    </>
  );
}

function DeckTabs({
  active,
  offsetDays,
  onSelect,
}: {
  active: DeckKey;
  offsetDays: number;
  onSelect: (key: DeckKey) => void;
}) {
  const deck = deckFor(active);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div role="tablist" aria-label="Demo deck" className="flex flex-wrap gap-1">
          {DECKS.map((option) => {
            const selected = option.key === active;
            return (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelect(option.key)}
                className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
                  selected
                    ? 'bg-raised font-medium text-foreground'
                    : 'text-muted hover:bg-raised hover:text-foreground'
                }`}
              >
                {option.name}
              </button>
            );
          })}
        </div>

        {/*
          The clock badge lives next to the cards, not only in the controls.
          "Due today: 3" is a confusing number if you have forgotten that you
          moved four days into the future.
        */}
        {offsetDays > 0 ? (
          <span className="shrink-0 rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-2xs text-accent-bright">
            clock +{offsetDays}d
          </span>
        ) : null}
      </div>

      {/*
        Two lines are reserved whether or not the blurb needs them. The three
        are different lengths, so one wraps where another does not, and without
        a floor the entire page below shifted by a line every time you changed
        tabs.
      */}
      <p className="mt-2 min-h-10 text-sm text-muted">{deck.blurb}</p>
    </div>
  );
}

/**
 * The card itself, plus the two things a first-timer needs around it: how to
 * drive it, and what just happened.
 */
function StudyPanel({ settings }: { settings: PlaygroundSettings }) {
  const [lastGrade, setLastGrade] = useState<string | null>(null);

  // A second scheduler instance, purely to narrate. Schedulers are stateless,
  // so this is free, and it is configured from the same retention target the
  // provider uses, so it reports exactly what the button the learner pressed
  // was promising.
  const narrator = useMemo(
    () => createFSRSScheduler({ desiredRetention: settings.retention }),
    [settings.retention],
  );

  const onCardGraded = useCallback(
    (quality: RecallQuality, card: Card) => {
      const preview = narrator.preview(card)[quality];
      const days = preview?.intervalDays ?? 0;
      setLastGrade(`${card.question} → back in ${formatDays(days)}`);
    },
    [narrator],
  );

  // Retuning retention makes the last line a lie, because it quotes an interval
  // the scheduler would no longer choose. A deck switch needs no such care: the
  // keyed provider above remounts this component outright.
  const previousRetention = useRef(settings.retention);
  if (previousRetention.current !== settings.retention) {
    previousRetention.current = settings.retention;
    if (lastGrade !== null) setLastGrade(null);
  }

  return (
    <div className="rounded-xl border border-line bg-surface/40 p-5 sm:p-8">
      <StudyView
        session={{ limit: settings.limit, order: settings.order }}
        onCardGraded={onCardGraded}
        emptyState={
          <>
            <p className="text-base font-medium text-foreground">
              Nothing due, which is the algorithm working
            </p>
            <p className="mx-auto mt-2 max-w-sm">
              Every card is scheduled for a day you have not reached yet. Wind the clock
              forward and they come back in the order FSRS decided.
            </p>
          </>
        }
        summaryState={(summary, restart) => (
          <>
            <p className="text-base font-medium text-foreground">
              {summary.cardsReviewed} card{summary.cardsReviewed === 1 ? '' : 's'},{' '}
              {Math.round(summary.accuracy * 100)}% recalled
            </p>
            <p className="mx-auto max-w-sm text-sm text-muted">
              That is one sitting. The interesting half is day two. Jump the clock forward
              and see which of these come back first.
            </p>
            {/* Unstyled on purpose: recall-theme.css owns this button, and the
                point of the page is that the theme is doing the work. */}
            <button type="button" onClick={restart}>
              Study again
            </button>
          </>
        )}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pt-4">
        <KeyboardLegend />
        {lastGrade ? (
          <p aria-live="polite" className="font-mono text-2xs text-subtle">
            {lastGrade}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function KeyboardLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <Key>Space</Key> reveal
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Key>1</Key>
        <Key>2</Key>
        <Key>3</Key>
        <Key>4</Key> grade
      </span>
    </p>
  );
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="grid h-5 min-w-5 place-items-center rounded border border-line bg-raised px-1 font-mono text-2xs text-foreground">
      {children}
    </kbd>
  );
}

function ProgressSection() {
  return (
    <section className="mt-12">
      <p className="label">Your progress</p>
      <h2 className="mb-1 mt-1 text-xl font-medium">
        What{' '}
        <code className="font-mono text-accent-bright">&lt;ProgressDashboard&gt;</code>{' '}
        renders
      </h2>
      <p className="mb-4 max-w-prose text-sm text-muted">
        Counts and the fourteen-day forecast, derived from your review log. The bars stay
        flat until you have graded something. Then the workload spreads out on its own.{' '}
        <span className="text-subtle">
          Retention stays at 0% for a while on purpose: like Anki, it only counts{' '}
          <em className="not-italic text-muted">mature</em> reviews, meaning cards that
          were already on an interval of three weeks or more when you graded them. Jump
          the clock forward a month or two and the figure becomes real.
        </span>
      </p>
      <ProgressDashboard forecastDays={14} />
    </section>
  );
}

/** Mirrors the library's interval formatting closely enough for a one-line note. */
function formatDays(days: number): string {
  if (days < 1) return `${Math.max(1, Math.round(days * 24 * 60))}m`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
