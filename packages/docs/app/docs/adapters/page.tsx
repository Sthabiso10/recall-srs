import type { Metadata } from 'next';
import { CodeBlock } from '@/components/CodeBlock';
import { Callout, PageHeader, Prose } from '@/components/Prose';

export const metadata: Metadata = { title: 'Storage adapters' };

const CUSTOM = `import type { StorageAdapter } from '@recall-srs/core';
import { StorageError } from '@recall-srs/core';

export function createMyApiAdapter(baseUrl: string): StorageAdapter {
  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(baseUrl + path, init);
    if (!res.ok) throw new StorageError(\`\${path} failed: \${res.status}\`);
    return res.json() as Promise<T>;
  }

  return {
    getCard:    (id)      => req(\`/cards/\${id}\`),
    listCards:  (q = {})  => req(\`/cards?\${new URLSearchParams(q as never)}\`),
    saveCard:   (card)    => req('/cards', { method: 'PUT', body: JSON.stringify(card) }),
    saveCards:  (cards)   => req('/cards/bulk', { method: 'PUT', body: JSON.stringify(cards) }),
    deleteCard: (id)      => req(\`/cards/\${id}\`, { method: 'DELETE' }),
    // ...decks and reviews
  } as StorageAdapter;
}`;

const CONVEX = `import { ConvexReactClient } from 'convex/react';
import { api } from '../convex/_generated/api';
import { createConvexAdapter } from '@recall-srs/adapter-convex';

const adapter = createConvexAdapter({
  client: new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!),
  api: api.recall,
});`;

const SWAP = `// Before: prototype
const adapter = createLocalStorageAdapter();

// After: real accounts, same everything else
const adapter = createSupabaseAdapter({ client: supabase });`;

export default function AdaptersPage() {
  return (
    <Prose>
      <PageHeader
        section="Reference"
        title="Storage adapters"
        lead="Recall never talks to a database directly. It talks to a ten-method interface. Prototype on localStorage, ship on Postgres, and change one line in between."
      />
      <p>
        Recall never talks to a database directly. It talks to a{' '}
        <code>StorageAdapter</code>, ten async methods covering cards, decks and review
        logs. Swapping backends is a one-line change.
      </p>
      <CodeBlock code={SWAP} language="ts" />

      <h2>Built in</h2>
      <AdapterList />

      <h2>Convex is shaped differently</h2>
      <p>
        The other backends are databases you query from the client. Convex is a database
        plus a server function layer, so the package has two halves. You copy{' '}
        <code>src/convex/schema.ts</code> and <code>src/convex/recall.ts</code> into your
        own <code>convex/</code> directory, Convex compiles them and generates the typed{' '}
        <code>api</code>, and the adapter calls those functions through the client.
      </p>
      <CodeBlock code={CONVEX} language="ts" />
      <p>
        Two things worth doing once it works, both sketched in the source: put grading and
        its review log in a single transaction (Convex mutations are atomic, so a dropped
        connection can never leave a rescheduled card without history), and subscribe to
        cards with <code>useQuery</code> so a review on a phone updates an open laptop tab
        with no refetch.
      </p>

      <h2>Writing your own</h2>
      <p>
        Four rules: every method async, review logs append-only, plain JSON-safe data in
        and out, and throw on failure rather than swallowing it.
      </p>
      <Callout tone="warn" title="Fail loudly">
        Throw <code>StorageError</code> rather than returning an empty array when a read
        fails. A silent empty deck reads as &ldquo;you&apos;re done for today!&rdquo; to a
        learner, and they will not come back to check.
      </Callout>
      <CodeBlock code={CUSTOM} language="ts" />
      <p>
        The localStorage adapter is the reference implementation, around 200 readable
        lines. Read it before writing yours.
      </p>
    </Prose>
  );
}

const ADAPTERS = [
  {
    name: '@recall-srs/adapter-localstorage',
    tag: 'No setup',
    body: 'Works offline, roughly 5MB per origin, no sync. Ideal for prototypes and local-first apps, and the reference implementation to read before writing your own.',
  },
  {
    name: '@recall-srs/adapter-supabase',
    tag: 'Postgres',
    skeleton: true,
    body: 'Row-level security, one table per entity. The bundled schema.sql is complete, but the queries are not written yet and every method throws.',
  },
  {
    name: '@recall-srs/adapter-firebase',
    tag: 'Firestore',
    skeleton: true,
    body: 'Subcollections under each user, which keeps security rules trivial. The queries are not written yet and every method throws.',
  },
  {
    name: '@recall-srs/adapter-convex',
    tag: 'Live queries',
    skeleton: true,
    body: 'Ships a schema and function file to copy into your convex/ directory. The schema and indexes are done; the function bodies are not.',
  },
];

function AdapterList() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ADAPTERS.map((adapter) => (
        <div key={adapter.name} className="rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <code className="font-mono text-sm text-foreground">{adapter.name}</code>
            <span className="flex items-center gap-1.5">
              {/* Status before stack: "which database" matters less than "does it run". */}
              {adapter.skeleton === true && (
                <span className="rounded-md border border-warn/40 px-2 py-0.5 text-xs text-warn">
                  Skeleton
                </span>
              )}
              <span className="rounded-md border border-line px-2 py-0.5 text-xs text-muted">
                {adapter.tag}
              </span>
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">{adapter.body}</p>
        </div>
      ))}
    </div>
  );
}
