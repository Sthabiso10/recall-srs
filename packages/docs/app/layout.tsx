import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Recall — spaced repetition for React',
    template: '%s · Recall',
  },
  description:
    'A production-grade spaced repetition framework for React and TypeScript. Drop SRS into your education app in minutes instead of rebuilding it.',
};

const NAV = [
  { href: '/docs/getting-started', label: 'Getting started' },
  { href: '/docs/algorithm', label: 'Algorithm' },
  { href: '/docs/api', label: 'API' },
  { href: '/docs/adapters', label: 'Adapters' },
  { href: '/playground', label: 'Playground' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b" style={{ borderColor: 'var(--recall-border)' }}>
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-6 px-6 py-4">
            <Link href="/" className="font-semibold">
              Recall
            </Link>
            <div className="flex flex-wrap gap-4 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="opacity-70 transition-opacity hover:opacity-100"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>

        <footer
          className="mt-16 border-t px-6 py-8 text-sm"
          style={{ borderColor: 'var(--recall-border)' }}
        >
          <div className="mx-auto max-w-5xl opacity-70">
            MIT licensed. Built from the spaced repetition engine behind DUSAN.
          </div>
        </footer>
      </body>
    </html>
  );
}
