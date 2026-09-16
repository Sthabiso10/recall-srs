import Link from 'next/link';
import { CodeBlock } from '@/components/CodeBlock';

const QUICKSTART = `import { SRSProvider, StudyView } from '@recall-srs/react';
import { createLocalStorageAdapter } from '@recall-srs/adapter-localstorage';

const adapter = createLocalStorageAdapter();

export default function Study() {
  return (
    <SRSProvider adapter={adapter} deckId="korean-101">
      <StudyView session={{ limit: 20 }} />
    </SRSProvider>
  );
}`;

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16">
      <section className="flex flex-col gap-6 pt-8">
        <h1 className="max-w-3xl text-5xl font-semibold leading-tight">
          Spaced repetition you don&apos;t have to build again.
        </h1>
        <p className="max-w-2xl text-lg opacity-75">
          Educators, language apps and EdTech teams keep rewriting the same SM-2
          scheduler, the same review queue and the same retention charts. Recall is
          that work, extracted, tested and ready to drop into your app.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/docs/getting-started"
            className="rounded-xl px-5 py-3 font-medium text-white"
            style={{ background: 'var(--recall-accent)' }}
          >
            Get started
          </Link>
          <Link
            href="/playground"
            className="rounded-xl border px-5 py-3 font-medium"
            style={{ borderColor: 'var(--recall-border)' }}
          >
            Try the playground
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Working flashcards in eight lines</h2>
        <CodeBlock code={QUICKSTART} />
        <p className="text-sm opacity-70">
          localStorage works with no setup. Swap in Supabase or Firebase later by
          changing one line — the interface is identical.
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        <Feature
          title="Zero-dependency core"
          body="The algorithm is pure TypeScript with no runtime dependencies. Use it from a CLI, a bot or React Native, not just the browser."
        />
        <Feature
          title="Headless-first"
          body="Every component takes a render prop. Use the defaults, restyle them with data-* hooks, or render your own UI on the same hooks."
        />
        <Feature
          title="Swappable storage"
          body="One StorageAdapter interface. Ten methods. Implement it against anything — Postgres, Dexie, your own API."
        />
      </section>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border p-6"
      style={{ borderColor: 'var(--recall-border)' }}
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm opacity-75">{body}</p>
    </div>
  );
}
