'use client';

/**
 * `<RecallIntl>` — language and number formatting for the default components.
 *
 * Optional. Without it, components use English strings and the runtime's own
 * locale for numbers, which is what they always did — so adding this breaks
 * nothing.
 *
 *   <RecallIntl locale="fr" strings={{ showAnswer: 'Voir la réponse' }}>
 *     <SRSProvider adapter={adapter}>
 *       <StudyView />
 *     </SRSProvider>
 *   </RecallIntl>
 *
 * `strings` is a deep partial: override the three you care about and the rest
 * stay English rather than turning into blanks.
 *
 * Numbers need no translation at all — passing `locale` is enough for "3d" to
 * become "3 j" or "3日", because `Intl` already knows.
 */

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { DeepPartial, RecallFormatters, RecallStrings } from '../utils/intl';
import { DEFAULT_STRINGS, createFormatters, mergeStrings } from '../utils/intl';

export interface RecallIntlValue {
  /** BCP 47 tag, or undefined for the runtime default. */
  locale: string | string[] | undefined;
  strings: RecallStrings;
  format: RecallFormatters;
}

const RecallIntlContext = createContext<RecallIntlValue | null>(null);

export interface RecallIntlProps {
  children: ReactNode;
  /**
   * BCP 47 locale tag, e.g. `"fr"`, `"ja"`, `"pt-BR"`.
   * Omit to use the runtime's locale, which in a browser is the user's own.
   */
  locale?: string | string[];
  /** Partial string overrides. Anything omitted falls back to English. */
  strings?: DeepPartial<RecallStrings>;
}

export function RecallIntl({ children, locale, strings }: RecallIntlProps) {
  // Serialised so an inline `strings={{ ... }}` object does not rebuild the
  // formatters on every render — the same trick SRSProvider uses for config.
  const stringsKey = JSON.stringify(strings ?? {});
  const localeKey = Array.isArray(locale) ? locale.join(',') : (locale ?? '');

  const value = useMemo<RecallIntlValue>(
    () => ({
      locale,
      strings: mergeStrings(strings),
      format: createFormatters(locale),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localeKey, stringsKey],
  );

  return <RecallIntlContext.Provider value={value}>{children}</RecallIntlContext.Provider>;
}

/**
 * Read the active strings and formatters.
 *
 * Falls back to English + the runtime locale when there is no provider, so
 * every component can call it unconditionally and nobody is forced to wrap
 * their app to use the library.
 */
export function useRecallIntl(): RecallIntlValue {
  const ctx = useContext(RecallIntlContext);
  const fallback = useMemo<RecallIntlValue>(
    () => ({
      locale: undefined,
      strings: DEFAULT_STRINGS,
      format: createFormatters(undefined),
    }),
    [],
  );
  return ctx ?? fallback;
}
