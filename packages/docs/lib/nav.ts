/**
 * One source of truth for the site's navigation.
 *
 * The header, the docs sidebar and the prev/next footer all read this, so a
 * new page is a single entry rather than three edits that drift apart.
 */

import reactPkg from '@recall-srs/react/package.json';

export interface NavItem {
  href: string;
  label: string;
  /** One line shown on the docs index cards and in the mobile menu. */
  summary?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Start here',
    items: [
      {
        href: '/docs',
        label: 'Introduction',
        summary:
          'What Recall is, what it is not, and how the three packages fit together.',
      },
      {
        href: '/docs/getting-started',
        label: 'Getting started',
        summary:
          'Install, create cards, render the study UI, or bring your own with a render prop.',
      },
    ],
  },
  {
    title: 'Concepts',
    items: [
      {
        href: '/docs/algorithm',
        label: 'Algorithm',
        summary:
          'FSRS and SM-2, retention targets, recall probability, and fitting weights to your learners.',
      },
    ],
  },
  {
    title: 'Reference',
    items: [
      {
        href: '/docs/api',
        label: 'API reference',
        summary: 'Everything exported from @recall-srs/core and @recall-srs/react.',
      },
      {
        href: '/docs/adapters',
        label: 'Storage adapters',
        summary: 'localStorage, Supabase, Firebase, Convex, and how to write your own.',
      },
    ],
  },
  {
    title: 'Try it',
    items: [
      {
        href: '/playground',
        label: 'Playground',
        summary: 'A live deck running FSRS in your browser, on localStorage.',
      },
    ],
  },
];

/** Reading order, flattened. Drives the prev/next links at the foot of a page. */
export const NAV_ORDER: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Top-level links in the header. A subset, kept short on purpose. */
export const HEADER_LINKS: NavItem[] = [
  { href: '/docs', label: 'Docs' },
  { href: '/docs/algorithm', label: 'Algorithm' },
  { href: '/docs/api', label: 'API' },
  { href: '/docs/adapters', label: 'Adapters' },
  { href: '/playground', label: 'Playground' },
];

export const GITHUB_URL = 'https://github.com/Sthabiso10/recall-srs';
export const NPM_URL = 'https://www.npmjs.com/package/@recall-srs/core';
/**
 * The version in the header, hero pill and footer.
 *
 * Read from the manifest rather than typed in, because it was hand-written and
 * had already drifted: the site advertised 0.2.0 while `@recall-srs/react` was
 * on 0.3.0 and `@recall-srs/core` on 0.2.1.
 *
 * Packages are versioned independently, so a single badge has to pick one.
 * It tracks `@recall-srs/react`, since that is the package this site is about
 * and the one a visitor is deciding whether to install.
 */
export const VERSION: string = reactPkg.version;

export function siblingsOf(pathname: string): { prev?: NavItem; next?: NavItem } {
  const clean = pathname.replace(/\/$/, '') || '/';
  const index = NAV_ORDER.findIndex((item) => item.href === clean);
  if (index === -1) return {};
  return { prev: NAV_ORDER[index - 1], next: NAV_ORDER[index + 1] };
}
