'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NAV_ORDER, type NavItem } from '@/lib/nav';
import { Search } from './Icons';

interface Entry {
  /** Page this came from. */
  page: string;
  /** Heading text, or the page summary for a page-level entry. */
  text: string;
  href: string;
  kind: 'page' | 'section';
}

/** Pages alone, so the dialog has something to show before the index lands. */
function pageEntries(items: NavItem[]): Entry[] {
  return items.map((item) => ({
    page: item.label,
    text: item.summary ?? '',
    href: item.href,
    kind: 'page',
  }));
}

/**
 * Builds the index by fetching each documentation page and reading its
 * headings out of the HTML.
 *
 * There is no MDX pipeline here and no frontmatter, so the rendered page is
 * the only source of truth for what sections exist. Six same-origin fetches on
 * first open is cheaper than a build step that can drift, and the browser
 * caches them. Falls back to page titles alone if anything fails.
 */
async function buildIndex(items: NavItem[]): Promise<Entry[]> {
  const parser = new DOMParser();

  const perPage = await Promise.all(
    items.map(async (item) => {
      const entries: Entry[] = [
        { page: item.label, text: item.summary ?? '', href: item.href, kind: 'page' },
      ];

      try {
        // `trailingSlash: true` in next.config — ask for the canonical URL so
        // the fetch is not a redirect on the static host.
        const response = await fetch(`${item.href.replace(/\/$/, '')}/`);
        if (!response.ok) return entries;

        const doc = parser.parseFromString(await response.text(), 'text/html');
        doc.querySelectorAll('article h2, article h3').forEach((node) => {
          const text = node.textContent?.trim();
          if (!text) return;
          const id =
            node.id ||
            text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .trim()
              .replace(/\s+/g, '-');
          entries.push({
            page: item.label,
            text,
            href: `${item.href}#${id}`,
            kind: 'section',
          });
        });
      } catch {
        /* Offline or blocked — page-level entries still work. */
      }

      return entries;
    }),
  );

  return perPage.flat();
}

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<Entry[]>(() => pageEntries(NAV_ORDER));
  const [indexed, setIndexed] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl-K from anywhere.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Index on first open, never on page load — nobody pays for search they
  // did not ask for.
  useEffect(() => {
    if (!open || indexed) return;
    setIndexed(true);
    void buildIndex(NAV_ORDER).then(setEntries);
  }, [open, indexed]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
    setCursor(0);
  }, [open]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries.filter((entry) => entry.kind === 'page');

    return entries
      .map((entry) => {
        const haystack = `${entry.page} ${entry.text}`.toLowerCase();
        const index = haystack.indexOf(needle);
        if (index === -1) return null;
        // Prefer a hit in the heading itself, and prefer an earlier one.
        const inText = entry.text.toLowerCase().includes(needle);
        return { entry, score: index + (inText ? 0 : 50) };
      })
      .filter((hit): hit is { entry: Entry; score: number } => hit !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 12)
      .map((hit) => hit.entry);
  }, [entries, query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, results.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const target = results[cursor];
      if (target) go(target.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-2xs text-subtle">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
            className="w-full max-w-lg overflow-hidden rounded-xl border border-line-strong bg-surface shadow-panel"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-3.5">
              <Search className="h-4 w-4 text-subtle" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Search the documentation…"
                aria-label="Search the documentation"
                className="h-11 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-subtle"
              />
              <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-2xs text-subtle">
                Esc
              </kbd>
            </div>

            <ul className="max-h-[50vh] overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <li className="px-2.5 py-6 text-center text-sm text-muted">
                  Nothing matches “{query}”.
                </li>
              ) : (
                results.map((entry, index) => (
                  <li key={`${entry.href}-${entry.text}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => go(entry.href)}
                      className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors ${
                        cursor === index ? 'bg-raised' : ''
                      }`}
                    >
                      <span className="text-sm text-foreground">
                        {entry.kind === 'section' ? entry.text : entry.page}
                      </span>
                      <span className="line-clamp-1 text-xs text-muted">
                        {entry.kind === 'section' ? entry.page : entry.text}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
