import type { Metadata } from 'next';
import Link from 'next/link';
import { Prose } from '@/components/Prose';

export const metadata: Metadata = { title: 'Documentation' };

const SECTIONS = [
  {
    href: '/docs/getting-started',
    title: 'Getting started',
    body: 'Install, create cards, render the study UI — or bring your own with a render prop.',
  },
  {
    href: '/docs/algorithm',
    title: 'Algorithm',
    body: 'FSRS and SM-2, retention targets, recall probability, and fitting weights to your learners.',
  },
  {
    href: '/docs/api',
    title: 'API reference',
    body: 'Everything exported from @recall-srs/core and @recall-srs/react.',
  },
  {
    href: '/docs/adapters',
    title: 'Storage adapters',
    body: 'localStorage, Supabase, Firebase, Convex — and how to write your own.',
  },
];

export default function DocsIndexPage() {
  return (
    <Prose>
      <h1>Documentation</h1>
      <p>
        Recall is a spaced repetition engine, a headless React layer, and pluggable storage.
        Start with getting started; the algorithm page is the one worth reading properly.
      </p>

      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="flex flex-col gap-2 rounded-2xl border p-5 no-underline transition-opacity hover:opacity-80"
            style={{ borderColor: 'var(--recall-border)' }}
          >
            <span className="font-semibold">{section.title}</span>
            <span className="text-sm opacity-75">{section.body}</span>
          </Link>
        ))}
      </div>
    </Prose>
  );
}
