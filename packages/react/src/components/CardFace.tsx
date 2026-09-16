'use client';

/**
 * `<CardFace>` — renders one side of a card.
 *
 * Content is plain text by default. Recall never calls `dangerouslySetInnerHTML`
 * on your behalf: if you store markdown or HTML in `question`/`answer`, pass a
 * `render` function and sanitise it yourself.
 *
 *   <CardFace card={card} side="answer" render={(text) => <Markdown>{text}</Markdown>} />
 */

import type { ReactNode } from 'react';
import type { Card } from '@recall-srs/core';

export interface CardFaceProps {
  card: Card;
  side: 'question' | 'answer';
  /** Custom renderer for the text — markdown, ruby annotations, audio players. */
  render?: (text: string, card: Card) => ReactNode;
  className?: string;
  /** Show category and tags under the content. Default true. */
  showMeta?: boolean;
}

export function CardFace({ card, side, render, className, showMeta = true }: CardFaceProps) {
  const text = side === 'question' ? card.question : card.answer;

  return (
    <div data-recall-card-face="" data-side={side} className={className}>
      <div data-recall-card-content="">{render ? render(text, card) : text}</div>

      {showMeta && (card.category || card.tags.length > 0) ? (
        <div data-recall-card-meta="">
          {card.category ? <span data-recall-card-category="">{card.category}</span> : null}
          {card.tags.map((tag) => (
            <span key={tag} data-recall-card-tag="">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
