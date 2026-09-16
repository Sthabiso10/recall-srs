import type { Metadata } from 'next';
import { CodeBlock, CommandLine } from '@/components/CodeBlock';
import { Callout, PageHeader, Prose, Step, Steps } from '@/components/Prose';

export const metadata: Metadata = { title: 'Getting started' };

const INSTALL =
  'pnpm add @recall-srs/core @recall-srs/react @recall-srs/adapter-localstorage';

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
    <>
      <PageHeader
        section="Start here"
        title="Getting started"
        lead="Recall is three packages: an engine, a React layer and a storage adapter. Start with localStorage, which needs no account and no schema, then swap the adapter when you add sign-in."
      />

      <Prose>
        <Steps>
          <Step title="Install">
            <CommandLine command={INSTALL} />
          </Step>

          <Step title="Create some cards">
            <p>
              <code>createCard</code> fills in the scheduling state so a new card is due
              immediately. Never build a <code>Card</code> object by hand.
            </p>
            <CodeBlock code={SEED} language="ts" filename="lib/seed.ts" />
          </Step>

          <Step title="Render the study UI">
            <p>
              <code>SRSProvider</code> loads cards and owns persistence. Everything below
              it can use the hooks.
            </p>
            <CodeBlock code={PROVIDER} language="tsx" filename="app/study/page.tsx" />
            <Callout title="Styling">
              The components render semantic markup with <code>data-*</code> hooks and no
              styles at all. The theme this site uses is one CSS file,{' '}
              <a href="https://github.com/Sthabiso10/recall-srs/blob/main/packages/docs/app/recall-theme.css">
                recall-theme.css
              </a>
              , written to be copied and edited.
            </Callout>
          </Step>

          <Step title="Or bring your own UI">
            <p>
              Pass a function as <code>children</code> and Recall renders nothing at all.
              You get the session state and the grading callbacks, and you own the markup.
            </p>
            <CodeBlock code={HEADLESS} language="tsx" />
          </Step>
        </Steps>

        <h2>Where to go next</h2>
        <ul>
          <li>
            <a href="/docs/algorithm">How the scheduling works</a>: intervals, ease
            factors and what the 0-5 grades mean
          </li>
          <li>
            <a href="/docs/adapters">Storage adapters</a>: Supabase, Firebase, or your own
            backend
          </li>
          <li>
            <a href="/playground">Playground</a>: a live deck running on localStorage
          </li>
        </ul>
      </Prose>
    </>
  );
}
