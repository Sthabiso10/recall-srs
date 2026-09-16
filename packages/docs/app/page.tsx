import Link from 'next/link';
import { CodeBlock, CommandLine } from '@/components/CodeBlock';
import { ArrowRight, Box, Braces, Database } from '@/components/Icons';
import { GITHUB_URL, VERSION } from '@/lib/nav';

const INSTALL = 'pnpm add @recall-srs/core @recall-srs/react';

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

const FEATURES = [
  {
    icon: Box,
    title: 'Zero-dependency core',
    body: 'Pure TypeScript with no runtime dependencies. Run the scheduler from a CLI, a bot or React Native. The browser is not a requirement.',
    href: '/docs/algorithm',
  },
  {
    icon: Braces,
    title: 'Headless-first React',
    body: 'Every component takes a render prop. Use the defaults, restyle them through data-* hooks, or render your own markup on the same session state.',
    href: '/docs/api',
  },
  {
    icon: Database,
    title: 'Swappable storage',
    body: 'One StorageAdapter interface, ten methods. Prototype on localStorage, ship on Postgres, and change one line in between.',
    href: '/docs/adapters',
  },
];

const ADAPTERS = ['localStorage', 'Supabase', 'Firebase', 'Convex'];

export default function HomePage() {
  return (
    <>
      <Hero />
      <Quickstart />
      <Features />
      <Adapters />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section
      className="mx-auto max-w-shell px-4 pb-16 pt-16 sm:px-6 sm:pt-24"
      aria-label="Intro"
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <Link
          href="/docs/algorithm"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-xs text-muted transition-colors hover:border-line-strong hover:text-foreground"
        >
          <span className="rounded-full bg-raised px-2 py-0.5 font-mono text-2xs text-secondary">
            v{VERSION}
          </span>
          FSRS and SM-2, behind one interface
          <ArrowRight className="h-3 w-3" />
        </Link>

        <h1 className="mt-6 text-4xl font-semibold text-foreground sm:text-5xl">
          Spaced repetition you don&apos;t have to build again
        </h1>

        <p className="mt-4 max-w-xl text-lg text-muted">
          Educators, language apps and EdTech teams keep rewriting the same scheduler, the
          same review queue and the same retention charts. Recall is that work, extracted
          and tested.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Link href="/docs/getting-started" className="btn btn-primary">
            Get started
          </Link>
          <Link href="/playground" className="btn btn-secondary">
            Open the playground
          </Link>
        </div>

        <div className="mt-8 w-full max-w-md">
          <CommandLine command={INSTALL} />
        </div>
      </div>
    </section>
  );
}

function Quickstart() {
  return (
    <section className="mx-auto max-w-shell px-4 py-16 sm:px-6" aria-label="Quick start">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
        <div>
          <p className="label">Quick start</p>
          <h2 className="mt-1.5 text-2xl font-semibold">
            Working flashcards in eight lines
          </h2>
          <p className="mt-3 text-muted">
            localStorage needs no account and no schema, so the first version runs
            immediately. Swap in Supabase, Firebase or Convex later by changing the
            adapter. The interface above it is identical.
          </p>
          <ul className="mt-5 flex flex-col gap-2.5 text-sm text-muted">
            {[
              'Scheduling state is created for you, so never build a Card by hand.',
              'The provider owns persistence; every hook below it just reads.',
              'Grade with the number keys 1-4, like every serious SRS client.',
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-[9px] h-1 w-1 flex-none rounded-full bg-subtle"
                />
                {line}
              </li>
            ))}
          </ul>
          <Link
            href="/docs/getting-started"
            className="group mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent-bright"
          >
            Full walkthrough
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <CodeBlock code={QUICKSTART} language="tsx" filename="app/study/page.tsx" />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="mx-auto max-w-shell px-4 py-16 sm:px-6" aria-label="What you get">
      <div className="grid gap-3 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <Link
            key={feature.title}
            href={feature.href}
            className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-raised"
          >
            <feature.icon className="h-4 w-4 text-muted transition-colors group-hover:text-accent-bright" />
            <h3 className="mt-3 text-base font-medium">{feature.title}</h3>
            <p className="mt-1.5 text-sm text-muted">{feature.body}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Adapters() {
  return (
    <section
      className="mx-auto max-w-shell px-4 py-8 sm:px-6"
      aria-label="Storage adapters"
    >
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          <span className="text-foreground">Ships with four backends.</span> Every one of
          them behind the same ten-method interface.
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {ADAPTERS.map((adapter) => (
            <li
              key={adapter}
              className="rounded-md border border-line bg-raised px-2 py-1 font-mono text-xs text-secondary"
            >
              {adapter}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-shell px-4 py-16 sm:px-6">
      <div className="flex flex-col items-center gap-5 rounded-xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="max-w-lg text-2xl font-semibold">
          Your learners forget on a curve. Schedule against it.
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/docs/getting-started" className="btn btn-primary">
            Read the docs
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-secondary"
          >
            Read the source
          </a>
        </div>
      </div>
    </section>
  );
}
