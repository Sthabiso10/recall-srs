'use client';

/**
 * `<StudyView>` — the flashcard interface.
 *
 * Headless-first, in two layers:
 *
 *   1. Render-prop mode. Pass a function as `children` and you get the whole
 *      session API with zero markup opinions:
 *
 *        <StudyView>
 *          {({ card, revealed, reveal, grade }) => <YourUI ... />}
 *        </StudyView>
 *
 *   2. Default mode. Omit `children` and you get semantic, unstyled markup with
 *      `data-*` hooks plus slots (`emptyState`, `loadingState`, `summaryState`)
 *      and `classNames` for the common case.
 *
 * Either way the component owns no scheduling logic — it renders what
 * `useStudySession` gives it.
 */

import type { ReactNode } from 'react';
import type { Card, RecallQuality, SchedulePreview, SessionConfig, SessionSummary } from '@recall-srs/core';
import { useStudySession } from '../hooks/useStudySession';
import { CardFace } from './CardFace';
import { RatingButtons } from './RatingButtons';
import { formatPercent } from '../utils/format';

/** Everything handed to the render prop. */
export interface StudyViewRenderProps {
  card: Card | null;
  revealed: boolean;
  completed: number;
  remaining: number;
  progress: number;
  summary: SessionSummary | null;
  loading: boolean;
  preview: Record<RecallQuality, SchedulePreview> | null;
  reveal: () => void;
  grade: (quality: RecallQuality) => Promise<void>;
  skip: () => void;
  restart: () => void;
}

export interface StudyViewClassNames {
  root?: string;
  progress?: string;
  card?: string;
  question?: string;
  answer?: string;
  revealButton?: string;
  rating?: string;
  summary?: string;
}

export interface StudyViewProps {
  /** Which cards this sitting draws from — deck, tags, limit, ordering. */
  session?: SessionConfig;
  /** Grades to offer. Defaults to Again/Hard/Good/Easy. */
  qualities?: RecallQuality[];
  /** Render prop. When provided, none of the default markup renders. */
  children?: (props: StudyViewRenderProps) => ReactNode;

  classNames?: StudyViewClassNames;
  className?: string;

  /** Shown when there is nothing due. This is a *good* screen — say so. */
  emptyState?: ReactNode;
  loadingState?: ReactNode;
  /** Shown once the sitting ends. Receives the summary. */
  summaryState?: (summary: SessionSummary, restart: () => void) => ReactNode;
  /** Custom content renderer, forwarded to `<CardFace>` (markdown, audio, …). */
  renderContent?: (text: string, card: Card) => ReactNode;

  onCardGraded?: (quality: RecallQuality, card: Card) => void;
  onSessionComplete?: (summary: SessionSummary) => void;
}

export function StudyView({
  session: sessionConfig,
  qualities,
  children,
  classNames = {},
  className,
  emptyState,
  loadingState,
  summaryState,
  renderContent,
  onCardGraded,
  onSessionComplete,
}: StudyViewProps) {
  const {
    currentCard,
    revealed,
    completed,
    remaining,
    progress,
    summary,
    loading,
    preview,
    reveal,
    grade,
    skip,
    restart,
  } = useStudySession(sessionConfig);

  async function handleGrade(quality: RecallQuality) {
    const graded = currentCard;
    await grade(quality);
    if (graded) onCardGraded?.(quality, graded);
    // TODO(you): `onSessionComplete` should fire exactly once, when the sitting
    // ends. Guard it with a ref — a naive call here fires on every re-render
    // after the last card.
    void onSessionComplete;
  }

  if (children) {
    return (
      <>
        {children({
          card: currentCard,
          revealed,
          completed,
          remaining,
          progress,
          summary,
          loading,
          preview,
          reveal,
          grade: handleGrade,
          skip,
          restart,
        })}
      </>
    );
  }

  if (loading) {
    return <div data-recall-study="" data-state="loading">{loadingState ?? 'Loading…'}</div>;
  }

  if (summary) {
    return (
      <div data-recall-study="" data-state="summary" className={classNames.summary}>
        {summaryState ? (
          summaryState(summary, restart)
        ) : (
          <>
            <p>
              {summary.cardsReviewed} reviewed · {formatPercent(summary.accuracy)} recalled
            </p>
            <button type="button" onClick={restart}>
              Study again
            </button>
          </>
        )}
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div data-recall-study="" data-state="empty">
        {emptyState ?? 'Nothing due right now. Come back later.'}
      </div>
    );
  }

  return (
    <div
      data-recall-study=""
      data-state={revealed ? 'revealed' : 'prompt'}
      className={className ?? classNames.root}
    >
      <div
        data-recall-progress=""
        className={classNames.progress}
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span data-recall-progress-text="">
          {completed} / {completed + remaining}
        </span>
      </div>

      <div data-recall-card="" className={classNames.card}>
        <CardFace
          card={currentCard}
          side="question"
          render={renderContent}
          className={classNames.question}
        />

        {revealed ? (
          <CardFace
            card={currentCard}
            side="answer"
            render={renderContent}
            className={classNames.answer}
            showMeta={false}
          />
        ) : null}
      </div>

      {revealed ? (
        <RatingButtons
          onRate={handleGrade}
          qualities={qualities}
          preview={preview}
          className={classNames.rating}
        />
      ) : (
        <button
          type="button"
          data-recall-reveal=""
          className={classNames.revealButton}
          onClick={reveal}
        >
          Show answer
        </button>
      )}

      <button type="button" data-recall-skip="" onClick={skip}>
        Skip
      </button>
    </div>
  );
}
