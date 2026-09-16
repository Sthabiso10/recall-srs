'use client';

/**
 * `<RatingButtons>` — how the learner grades a card.
 *
 * Shows the projected interval on each button ("Again · 1d", "Easy · 12d").
 * That preview is the difference between a grade the learner guesses at and one
 * they choose, so it is on by default.
 *
 * Styling: unstyled by default. Every element carries `data-*` attributes, so
 * you can target them from plain CSS, Tailwind's arbitrary variants, or pass
 * `className` / `buttonClassName` directly.
 *
 *   [data-recall-rating][data-quality="1"] { background: #fee; }
 */

import { useEffect, useRef } from 'react';
import type { RecallQuality, SchedulePreview } from '@recall-srs/core';
import { DEFAULT_QUALITIES, QUALITY_LABELS, formatInterval } from '../utils/format';

export interface RatingButtonsProps {
  onRate: (quality: RecallQuality) => void;
  /** Which grades to offer. Defaults to [1, 3, 4, 5] — Again/Hard/Good/Easy. */
  qualities?: RecallQuality[];
  /** From `useStudySession().preview`. Omit to hide interval hints. */
  preview?: Record<RecallQuality, SchedulePreview> | null;
  labels?: Partial<Record<RecallQuality, string>>;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string | ((quality: RecallQuality) => string);
  /** Bind number keys 1-N to the buttons. Default true. */
  keyboardShortcuts?: boolean;
}

export function RatingButtons({
  onRate,
  qualities = DEFAULT_QUALITIES,
  preview,
  labels,
  disabled = false,
  className,
  buttonClassName,
  keyboardShortcuts = true,
}: RatingButtonsProps) {
  // Number keys 1..N map to the offered grades, in order. Serious learners
  // grade with the keyboard and never touch the mouse; without this, a long
  // session is hundreds of round trips to a button.
  const onRateRef = useRef(onRate);
  onRateRef.current = onRate;

  useEffect(() => {
    if (!keyboardShortcuts || disabled) return;

    function handler(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Never steal a keystroke the user meant for a field — typing "4" in a
      // search box must not grade the card behind it.
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }

      const index = Number.parseInt(event.key, 10) - 1;
      const quality = qualities[index];
      if (Number.isNaN(index) || quality === undefined) return;

      event.preventDefault();
      onRateRef.current(quality);
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [keyboardShortcuts, disabled, qualities]);

  return (
    <div data-recall-rating-group="" className={className} role="group" aria-label="Rate your recall">
      {qualities.map((quality, index) => {
        const hint = preview?.[quality];
        const label = labels?.[quality] ?? QUALITY_LABELS[quality];
        const cls =
          typeof buttonClassName === 'function' ? buttonClassName(quality) : buttonClassName;

        return (
          <button
            key={quality}
            type="button"
            data-recall-rating=""
            data-quality={quality}
            data-lapse={hint?.lapses ? '' : undefined}
            className={cls}
            disabled={disabled}
            onClick={() => onRate(quality)}
            aria-keyshortcuts={keyboardShortcuts ? String(index + 1) : undefined}
          >
            <span data-recall-rating-label="">{label}</span>
            {hint ? (
              <span data-recall-rating-interval="">{formatInterval(hint.intervalDays)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
