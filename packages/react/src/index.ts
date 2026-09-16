/**
 * @recall-srs/react — components and hooks.
 *
 * The whole package is client-side (see the `use client` banner in
 * tsup.config.ts), so it imports cleanly into a Next.js App Router tree.
 */

/* ---- internationalisation ------------------------------------------- */
export { RecallIntl, useRecallIntl } from './context/RecallIntl';
export type { RecallIntlProps, RecallIntlValue } from './context/RecallIntl';
export type { DeepPartial, RecallFormatters, RecallStrings } from './utils/intl';
export { DEFAULT_STRINGS, createFormatters, mergeStrings } from './utils/intl';

/* ---- provider ------------------------------------------------------- */
export { SRSProvider, useSRSContext } from './context/SRSProvider';
export type { SRSContextValue, SRSProviderProps } from './context/SRSProvider';

/* ---- hooks ---------------------------------------------------------- */
export { useSRS } from './hooks/useSRS';
export type { UseSRSResult } from './hooks/useSRS';
export { useStudySession } from './hooks/useStudySession';
export type { UseStudySessionResult } from './hooks/useStudySession';
export { useProgress } from './hooks/useProgress';
export type { UseProgressOptions, UseProgressResult } from './hooks/useProgress';

/* ---- components ----------------------------------------------------- */
export { StudyView } from './components/StudyView';
export type {
  StudyViewClassNames,
  StudyViewProps,
  StudyViewRenderProps,
} from './components/StudyView';
export { ProgressDashboard } from './components/ProgressDashboard';
export type {
  ProgressDashboardProps,
  ProgressDashboardRenderProps,
} from './components/ProgressDashboard';
export { RatingButtons } from './components/RatingButtons';
export type { RatingButtonsProps } from './components/RatingButtons';
export { CardFace } from './components/CardFace';
export type { CardFaceProps } from './components/CardFace';

/* ---- display helpers ------------------------------------------------ */
export {
  DEFAULT_QUALITIES,
  QUALITY_LABELS,
  formatDuration,
  formatInterval,
  formatPercent,
} from './utils/format';

/**
 * Re-exported for convenience so apps can type their own components without a
 * direct `@recall-srs/core` import. The core remains the canonical source.
 */
export type {
  Card,
  CardId,
  DeckId,
  RecallQuality,
  ReviewLog,
  SessionConfig,
  SessionSummary,
  StorageAdapter,
  StudyDeck,
} from '@recall-srs/core';
