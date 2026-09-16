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
  // TODO(you): wire up the keyboard shortcuts with a useEffect + keydown
  // listener. Remember to ignore the event when the target is an input or
  // contentEditable — otherwise typing "4" in a search box grades a card.
  void keyboardShortcuts;

  return (
    <div data-recall-rating-group="" className={className} role="group" aria-label="Rate your recall">
      {qualities.map((quality) => {
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
