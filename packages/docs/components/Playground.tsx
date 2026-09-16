'use client';

/**
 * The live demo — and the end-to-end smoke test for the whole stack.
 *
 * If this page works, the adapter, the provider, the session hook and the
 * components all work together. Break the library and this is the first thing
 * that shows it.
 */

import { useEffect, useMemo, useState } from 'react';
import { createCard, createFSRSScheduler, type Card } from '@recall-srs/core';
import { ProgressDashboard, SRSProvider, StudyView } from '@recall-srs/react';
import { createLocalStorageAdapter } from '@recall-srs/adapter-localstorage';
import { GITHUB_URL } from '@/lib/nav';
import { ArrowUpRight } from './Icons';

const DECK_ID = 'playground-korean';
const NAMESPACE = 'recall-docs';

/**
 * Guards the one-time seed against React StrictMode.
 *
 * In development StrictMode invokes effects twice. Both passes read an empty
 * deck before either has written, both seed it, and the deck ends up with two
 * of everything — the playground showed 16 cards for an 8-card deck. A module
 * level promise makes the seed run once per page load no matter how many times
 * the effect fires, which is the shape any "seed on first run" effect needs.
 */
let seedOnce: Promise<void> | null = null;

// Built once, outside the component: schedulers are stateless, but a fresh
// instance each render would re-run every downstream useMemo.
const scheduler = createFSRSScheduler({ desiredRetention: 0.9 });

/** A handful of cards so the demo has something to teach. */
const SEED: Array<[string, string, string]> = [
  ['물', 'water', 'noun'],
  ['불', 'fire', 'noun'],
  ['산', 'mountain', 'noun'],
  ['하늘', 'sky', 'noun'],
  ['먹다', 'to eat', 'verb'],
  ['가다', 'to go', 'verb'],
  ['크다', 'to be big', 'adjective'],
  ['빠르다', 'to be fast', 'adjective'],
];

const SHORTCUTS: Array<[string, string]> = [
  ['1', 'Again'],
  ['2', 'Hard'],
  ['3', 'Good'],
  ['4', 'Easy'],
];

export function Playground() {
  // The adapter must be stable across renders — a new one each render would
  // reset the provider's card cache on every keystroke.
  const adapter = useMemo(() => createLocalStorageAdapter({ namespace: NAMESPACE }), []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    seedOnce ??= (async () => {
      await adapter.init?.();
      const existing = await adapter.listCards({ deckId: DECK_ID });
      if (existing.length > 0) return;

      const cards: Card[] = SEED.map(([question, answer, category]) =>
        createCard({ question, answer, category, tags: ['korean'], deckId: DECK_ID }),
      );
      await adapter.saveCards(cards);
    })();

    void seedOnce.then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  if (!ready) {
    return (
      <div className="flex min-h-[22rem] items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
        Preparing the deck…
      </div>
    );
  }

  return (
    <SRSProvider adapter={adapter} deckId={DECK_ID} scheduler={scheduler}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-10">
        <div className="rounded-xl border border-line bg-surface/40 p-5 sm:p-8">
          <StudyView
            session={{ limit: 10, order: 'interleaved' }}
            emptyState={
              <>
                <p className="text-base font-medium text-foreground">
                  Nothing due right now
                </p>
                <p className="mx-auto mt-2 max-w-sm">
                  Which is the algorithm working. Come back tomorrow, or reset the deck to
                  start over.
                </p>
              </>
            }
          />
        </div>

        <PlaygroundRail />
      </div>

      <section className="mt-10">
        <p className="label">Your progress</p>
        <h2 className="mb-4 mt-1 text-xl font-medium">
          What{' '}
          <code className="font-mono text-accent-bright">&lt;ProgressDashboard&gt;</code>{' '}
          renders
        </h2>
        <ProgressDashboard forecastDays={14} />
      </section>
    </SRSProvider>
  );
}

function PlaygroundRail() {
  return (
    <aside className="flex flex-col gap-5 text-sm lg:sticky lg:top-20 lg:self-start">
      <div>
        <p className="label">Keyboard</p>
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {SHORTCUTS.map(([key, label]) => (
            <li key={key} className="flex items-center gap-3 text-muted">
              <kbd className="grid h-5 w-5 place-items-center rounded border border-line bg-raised font-mono text-2xs text-foreground">
                {key}
              </kbd>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="label">Running here</p>
        <ul className="mt-2.5 flex flex-col gap-1.5 text-muted">
          <li>FSRS, retention target 0.9</li>
          <li>10 cards per sitting, interleaved</li>
          <li>localStorage, namespace {NAMESPACE}</li>
        </ul>
      </div>

      <div className="flex flex-col items-start gap-3 border-t border-line pt-4">
        <ResetButton />
        <a
          href={`${GITHUB_URL}/blob/main/packages/docs/components/Playground.tsx`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
        >
          Read this page&apos;s source
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </aside>
  );
}

/**
 * Wipes the demo deck.
 *
 * This reaches past the adapter and deletes its key directly, which an app
 * should never do — but "clear everything" is deliberately not part of the
 * StorageAdapter interface, and a demo needs a reset. Reloading afterwards is
 * the honest way to get the provider back to a cold start.
 */
function ResetButton() {
  function reset() {
    try {
      window.localStorage.removeItem(`${NAMESPACE}:v1`);
    } catch {
      /* Storage disabled — the reload below is then a no-op, which is fine. */
    }
    window.location.reload();
  }

  return (
    <button type="button" onClick={reset} className="btn btn-secondary">
      Reset the deck
    </button>
  );
}
