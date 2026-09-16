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

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Card, RecallQuality, SchedulePreview, SessionConfig, SessionSummary } from '@recall-srs/core';
import { useStudySession } from '../hooks/useStudySession';
import { CardFace } from './CardFace';
import { RatingButtons } from './RatingButtons';
import { useRecallIntl } from '../context/RecallIntl';

/** Everything handed to the render prop. */
export interface StudyViewRenderProps {
  card: Card | null;
  /** Queue drained, but a relearning step is pending. Not the same as finished. */
  awaitingRelearning: boolean;
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
  /** Shown while the queue is drained but a relearning step is still pending. */
  relearningState?: ReactNode;

  /**
   * One-off label overrides, for when a single screen needs different wording
   * than the rest of the app ("Reveal" instead of "Show answer", say).
   *
   * For translating the whole UI, wrap the tree in `<RecallIntl locale="fr">`
   * instead — these are an escape hatch, not a translation mechanism.
   */
  revealLabel?: ReactNode;
  skipLabel?: ReactNode;
  restartLabel?: ReactNode;
  /** Shown once the sitting ends. Receives the summary. */
  summaryState?: (summary: SessionSummary, restart: () => void) => ReactNode;

  /**
   * Bind Space and Enter to reveal the answer. Default true.
   *
   * `<RatingButtons>` already binds 1-N to the grades, so without this a
   * learner keys the grade but has to reach for the mouse to flip the card,
   * the one keystroke they make more than any other. Only active while the
   * answer is hidden; once revealed the number keys own the keyboard.
   */
  revealShortcut?: boolean;
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
  relearningState,
  revealLabel,
  skipLabel,
  restartLabel,
  summaryState,
  revealShortcut = true,
  renderContent,
  onCardGraded,
  onSessionComplete,
}: StudyViewProps) {
  const intl = useRecallIntl();
  const {
    currentCard,
    awaitingRelearning,
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

  // Fire onSessionComplete exactly once per sitting. Calling it inline after a
  // grade would fire on every re-render once the queue empties; keying the ref
  // on the summary's session id also lets `restart()` arm it again.
  const completedSessionId = useRef<string | null>(null);
  useEffect(() => {
    if (!summary) return;
    if (completedSessionId.current === summary.sessionId) return;
    completedSessionId.current = summary.sessionId;
    onSessionComplete?.(summary);
  }, [summary, onSessionComplete]);

  /**
   * Space / Enter reveals the answer.
   *
   * The counterpart to the number keys `<RatingButtons>` binds. Only armed
   * while a card is on screen and still hidden, so it can never fight the
   * grade keys, and only in default mode, because a render prop owns its own
   * keyboard the same way it owns its own markup.
   */
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  const canReveal = Boolean(currentCard) && !revealed && !children;

  useEffect(() => {
    if (!revealShortcut || !canReveal) return;

    function handler(event: KeyboardEvent) {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Both keys already mean "activate" on a focused control, and Space
      // scrolls the page from anywhere else. Leave those alone rather than
      // revealing twice or swallowing a deliberate keystroke.
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT') return;
        if (tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }

      event.preventDefault();
      revealRef.current();
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealShortcut, canReveal]);

  async function handleGrade(quality: RecallQuality) {
    const graded = currentCard;
    await grade(quality);
    if (graded) onCardGraded?.(quality, graded);
  }

  if (children) {
    return (
      <>
        {children({
          card: currentCard,
          awaitingRelearning,
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
    return <div data-recall-study="" data-state="loading">{loadingState ?? intl.strings.loading}</div>;
  }

  if (summary) {
    return (
      <div
        data-recall-study=""
        data-state="summary"
        className={classNames.summary}
        role="status"
      >
        {summaryState ? (
          summaryState(summary, restart)
        ) : (
          <>
            <p>
              {intl.format.number(summary.cardsReviewed)} · {intl.format.percent(summary.accuracy)}
            </p>
            <button type="button" onClick={restart}>
              {restartLabel ?? intl.strings.studyAgain}
            </button>
          </>
        )}
      </div>
    );
  }

  if (!currentCard) {
    // Distinguish "finished" from "waiting on a relearning step". Showing
    // "nothing due" here would tell a learner they were done moments before a
    // card they just failed comes back.
    if (awaitingRelearning) {
      return (
        <div data-recall-study="" data-state="relearning-wait" role="status">
          {relearningState ?? intl.strings.relearningWait}
        </div>
      );
    }

    return (
      <div data-recall-study="" data-state="empty">
        {emptyState ?? intl.strings.nothingDue}
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
        aria-label={intl.strings.progress}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${completed} of ${completed + remaining} cards reviewed`}
      >
        <span data-recall-progress-text="">
          {completed} / {completed + remaining}
        </span>
      </div>

      {/*
        Revealing the answer swaps content in place, which a screen reader has
        no reason to notice. aria-live announces it. This is a learning tool —
        a blind learner who cannot hear the answer appear cannot use it at all.
      */}
      <div
        data-recall-card=""
        className={classNames.card}
        aria-live="polite"
        aria-atomic="true"
      >
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
          aria-keyshortcuts={revealShortcut ? 'Space Enter' : undefined}
        >
          {revealLabel ?? intl.strings.showAnswer}
        </button>
      )}

      <button type="button" data-recall-skip="" onClick={skip}>
        {skipLabel ?? intl.strings.skip}
      </button>
    </div>
  );
}
