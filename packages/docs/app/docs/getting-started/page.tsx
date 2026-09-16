import type { Metadata } from 'next';
import { CodeBlock } from '@/components/CodeBlock';
import { Prose } from '@/components/Prose';

export const metadata: Metadata = { title: 'Getting started' };

const INSTALL = `pnpm add @recall-srs/core @recall-srs/react @recall-srs/adapter-localstorage`;

const SEED = `import { createCard } from '@recall-srs/core';
import { createLocalStorageAdapter } from '@recall-srs/adapter-localstorage';

const adapter = createLocalStorageAdapter({ namespace: 'korean' });

await adapter.saveCards([
  createCard({ question: '물', answer: 'water', tags: ['noun'], deckId: 'korean-101' }),
  createCard({ question: '불', answer: 'fire',  tags: ['noun'], deckId: 'korean-101' }),
]);`;

const PROVIDER = `'use client';

import { SRSProvider, StudyView, ProgressDashboard } from '@recall-srs/react';
import { adapter } from './adapter';

export function StudyPage() {
  return (
    <SRSProvider adapter={adapter} deckId="korean-101">
      <StudyView session={{ limit: 20, order: 'interleaved' }} />
      <ProgressDashboard />
    </SRSProvider>
  );
}`;

const HEADLESS = `<StudyView>
  {({ card, revealed, reveal, grade, preview, progress }) =>
    !card ? (
      <DoneScreen />
    ) : (
      <YourCardShell progress={progress}>
        <h2>{card.question}</h2>
        {revealed ? <p>{card.answer}</p> : <button onClick={reveal}>Show</button>}
        {revealed && (
          <YourButtons
            onRate={grade}
            hints={preview}   // "Again · 1d", "Easy · 12d"
          />
        )}
      </YourCardShell>
    )
  }
</StudyView>`;

export default function GettingStartedPage() {
  return (
    <Prose>
      <h1>Getting started</h1>
      <p>
        Recall is three packages: an engine, a React layer and a storage adapter. Start
        with localStorage — it needs no account and no schema — then swap the adapter
        when you add sign-in.
      </p>

      <h2>1. Install</h2>
      <CodeBlock code={INSTALL} language="bash" />

      <h2>2. Create some cards</h2>
      <p>
        <code>createCard</code> fills in the scheduling state so a new card is due
        immediately. Never build a <code>Card</code> object by hand.
      </p>
      <CodeBlock code={SEED} language="ts" />

      <h2>3. Render the study UI</h2>
      <p>
        <code>SRSProvider</code> loads cards and owns persistence. Everything below it
        can use the hooks.
      </p>
      <CodeBlock code={PROVIDER} language="tsx" />

      <h2>4. Or bring your own UI</h2>
      <p>
        Pass a function as <code>children</code> and Recall renders nothing at all —
        you get the session state and the grading callbacks, and you own the markup.
      </p>
      <CodeBlock code={HEADLESS} language="tsx" />

      <h2>Where to go next</h2>
      <ul>
        <li>
          <a href="/docs/algorithm">How the scheduling works</a> — intervals, ease
          factors and what the 0-5 grades mean
        </li>
        <li>
          <a href="/docs/adapters">Storage adapters</a> — Supabase, Firebase, or your
          own backend
        </li>
        <li>
          <a href="/playground">Playground</a> — a live deck running on localStorage
        </li>
      </ul>
    </Prose>
  );
}
