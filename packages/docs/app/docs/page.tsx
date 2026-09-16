import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/components/Icons';
import { PageHeader, Prose } from '@/components/Prose';
import { NAV_ORDER } from '@/lib/nav';

export const metadata: Metadata = { title: 'Introduction' };

const PACKAGES = [
  {
    name: '@recall-srs/core',
    role: 'The engine',
    body: 'Scheduling, queue building, session state and stats. Pure TypeScript, no dependencies, no React.',
  },
  {
    name: '@recall-srs/react',
    role: 'The UI layer',
    body: 'A provider, three hooks and four components, every one of them headless if you want it to be.',
  },
  {
    name: '@recall-srs/adapter-*',
    role: 'The storage',
    body: 'localStorage, Supabase, Firebase and Convex, all behind the same ten-method interface.',
  },
];

// The introduction links to everything after it, so drop the page itself.
const NEXT_PAGES = NAV_ORDER.filter((item) => item.href !== '/docs');

export default function DocsIndexPage() {
  return (
    <>
      <PageHeader
        section="Documentation"
        title="Introduction"
        lead="Recall is a spaced repetition engine, a headless React layer, and pluggable storage. Start with getting started; the algorithm page is the one worth reading properly."
      />

      <Prose>
        <p>
          Every app that teaches something eventually needs a review schedule, and every
          team builds the same one: an ease factor, a due date, a queue, a chart nobody
          trusts. Recall is that stack written once and tested, so the interesting part of
          your product can be the content rather than the arithmetic.
        </p>

        <h2>The three packages</h2>
        <p>
          They are separate installs on purpose. A CLI or a Discord bot takes the core
          alone; a React app adds the second; the adapter you choose depends on where the
          data lives.
        </p>

        <div className="grid gap-2">
          {PACKAGES.map((pkg) => (
            <div key={pkg.name} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <code className="font-mono text-sm text-foreground">{pkg.name}</code>
                <span className="rounded border border-line px-1.5 py-0.5 text-xs text-muted">
                  {pkg.role}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">{pkg.body}</p>
            </div>
          ))}
        </div>

        <h2>Where to go next</h2>

        <div className="grid gap-2 sm:grid-cols-2">
          {NEXT_PAGES.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="group flex flex-col gap-1 rounded-lg border border-line bg-surface p-4 no-underline transition-colors hover:border-line-strong hover:bg-raised"
            >
              <span className="flex items-center gap-1.5 text-base font-medium text-foreground">
                {page.label}
                <ArrowRight className="h-3.5 w-3.5 text-subtle transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-sm text-muted">{page.summary}</span>
            </Link>
          ))}
        </div>
      </Prose>
    </>
  );
}
