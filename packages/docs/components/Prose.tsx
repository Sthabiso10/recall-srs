/**
 * Shared typographic wrapper for documentation pages.
 *
 * Hand-rolled rather than `@tailwindcss/typography`, to keep the docs' own
 * dependency list short — the library is the product, the site is scaffolding.
 */

import type { ReactNode } from 'react';

export function Prose({ children }: { children: ReactNode }) {
  return (
    <article
      className="flex max-w-3xl flex-col gap-5
        [&_a]:underline
        [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]
        [&_h1]:text-4xl [&_h1]:font-semibold
        [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold
        [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold
        [&_li]:ml-5 [&_li]:list-disc
        [&_p]:opacity-85
        [&_table]:w-full [&_table]:text-left [&_table]:text-sm
        [&_th]:pb-2 [&_th]:font-semibold
        [&_td]:border-t [&_td]:py-2 [&_td]:align-top"
    >
      {children}
    </article>
  );
}
