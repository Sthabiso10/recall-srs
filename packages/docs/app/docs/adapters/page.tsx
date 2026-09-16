import type { Metadata } from 'next';
import { CodeBlock } from '@/components/CodeBlock';
import { Prose } from '@/components/Prose';

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

const SWAP = `// Before — prototype
const adapter = createLocalStorageAdapter();

// After — real accounts, same everything else
const adapter = createSupabaseAdapter({ client: supabase });`;

export default function AdaptersPage() {
  return (
    <Prose>
      <h1>Storage adapters</h1>
      <p>
        Recall never talks to a database directly. It talks to a{' '}
        <code>StorageAdapter</code> — ten async methods covering cards, decks and review
        logs. Swapping backends is a one-line change.
      </p>
      <CodeBlock code={SWAP} language="ts" />

      <h2>Built in</h2>
      <table>
        <tbody>
          <tr>
            <td>
              <code>@recall-srs/adapter-localstorage</code>
            </td>
            <td className="opacity-75">
              No setup, works offline, ~5MB per origin, no sync. Ideal for prototypes and
              local-first apps.
            </td>
          </tr>
          <tr>
            <td>
              <code>@recall-srs/adapter-supabase</code>
            </td>
            <td className="opacity-75">
              Postgres with row-level security. Run the bundled <code>schema.sql</code>{' '}
              first; pass your own configured client.
            </td>
          </tr>
          <tr>
            <td>
              <code>@recall-srs/adapter-firebase</code>
            </td>
            <td className="opacity-75">
              Firestore subcollections under each user. Watch per-document read costs on
              stats screens.
            </td>
          </tr>
          <tr>
            <td>
              <code>@recall-srs/adapter-convex</code>
            </td>
            <td className="opacity-75">
              Deployed server functions plus live queries. Ships a schema and function file
              to copy into your <code>convex/</code> directory.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Convex is shaped differently</h2>
      <p>
        The other backends are databases you query from the client. Convex is a database
        plus a server function layer — so the package has two halves. You copy{' '}
        <code>src/convex/schema.ts</code> and <code>src/convex/recall.ts</code> into your own{' '}
        <code>convex/</code> directory, Convex compiles them and generates the typed{' '}
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
        and out, and throw <code>StorageError</code> rather than returning an empty array
        on failure — a silent empty deck looks like &ldquo;you&apos;re done!&rdquo; to a
        learner.
      </p>
      <CodeBlock code={CUSTOM} language="ts" />
      <p>
        The localStorage adapter is the reference implementation — around 200 readable
        lines. Read it before writing yours.
      </p>
    </Prose>
  );
}
