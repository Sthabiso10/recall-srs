import type { Metadata } from 'next';
import { Playground } from '@/components/Playground';
import { PageHeader } from '@/components/Prose';

export const metadata: Metadata = {
  title: 'Playground',
  description:
    'Three live decks running FSRS in your browser. Grade a sitting, wind the clock forward, and watch the scheduler decide what comes back.',
};

export default function PlaygroundPage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 lg:py-14">
      <PageHeader
        section="Try it"
        title="Playground"
        lead={
          <>
            Real decks running FSRS in your browser, stored by{' '}
            <code className="rounded border border-line bg-raised px-1 py-0.5 font-mono text-[0.875em] text-foreground">
              @recall-srs/adapter-localstorage
            </code>
            . Grade a sitting, then wind the clock forward. Day two is where a spaced
            repetition engine either earns its keep or does not. Nothing leaves your
            machine, and clearing site data resets it.
          </>
        }
      />
      <Playground />
    </div>
  );
}
