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

const DECK_ID = 'playground-korean';

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

export function Playground() {
  // The adapter must be stable across renders — a new one each render would
  // reset the provider's card cache on every keystroke.
  const adapter = useMemo(() => createLocalStorageAdapter({ namespace: 'recall-docs' }), []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function seed() {
      await adapter.init?.();
      const existing = await adapter.listCards({ deckId: DECK_ID });
      if (existing.length === 0) {
        const cards: Card[] = SEED.map(([question, answer, category]) =>
          createCard({ question, answer, category, tags: [category], deckId: DECK_ID }),
        );
        await adapter.saveCards(cards);
      }
      if (!cancelled) setReady(true);
    }

    void seed();
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  if (!ready) {
    return <div className="opacity-60">Preparing the deck…</div>;
  }

  return (
    <SRSProvider adapter={adapter} deckId={DECK_ID} scheduler={scheduler}>
      <div className="flex flex-col gap-10">
        <StudyView
          session={{ limit: 10, order: 'interleaved' }}
          emptyState={
            <p className="opacity-75">
              Nothing due right now — which is the algorithm working. Come back tomorrow,
              or clear this site&apos;s storage to start over.
            </p>
          }
        />
        <ProgressDashboard forecastDays={14} />
      </div>
    </SRSProvider>
  );
}
