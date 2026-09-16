/**
 * @jest-environment jsdom
 */

/**
 * When a study session rebuilds its queue, and when it must not.
 *
 * These pin a bug that shipped: `useStudySession` latched a "seeded" ref on the
 * first non-empty load and never rebuilt again, so anything that replaced the
 * card set afterwards left the learner grading a queue built from cards that
 * were no longer on screen. Switching decks kept the old deck's queue.
 *
 * The fix hangs on one distinction, and both halves of it are load-bearing:
 *
 *   - a grade replaces the `cards` map but changes nothing about which cards
 *     the session should hold, so the queue must survive it;
 *   - a load replaces the `cards` map because they are different cards, so the
 *     queue must be thrown away.
 *
 * Nothing here mocks the provider. The whole failure lived in how the provider
 * and the hook talk to each other, so a test that stubbed the context would
 * have passed against the broken version.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import {
  createCard,
  createFSRSScheduler,
  type Card,
  type ReviewLog,
  type StorageAdapter,
} from '@recall-srs/core';
import { SRSProvider } from '../src/context/SRSProvider';
import { StudyView } from '../src/components/StudyView';

const scheduler = createFSRSScheduler();

function deck(deckId: string, questions: string[]): Card[] {
  return questions.map((question) =>
    createCard({ question, answer: `${question}!`, deckId, tags: [] }),
  );
}

/**
 * An in-memory adapter that counts its reads and can be made to hang.
 *
 * `block()` holds the next `listCards` open until the test releases it, which
 * turns "what is on screen while a load is in flight" from a race into an
 * assertion. Only the card methods are real; the rest throw rather than
 * returning empty, so a test that quietly starts depending on decks or review
 * history fails loudly instead of passing on a lie.
 */
function memoryAdapter(initial: Card[]) {
  const cards = new Map(initial.map((card) => [card.id, card]));
  const reviews: ReviewLog[] = [];
  let listCalls = 0;
  let gate: Promise<void> | null = null;

  /** Hold every load open until the returned function is called. */
  function block(): () => void {
    let open!: () => void;
    gate = new Promise<void>((resolve) => {
      open = () => {
        gate = null;
        resolve();
      };
    });
    return open;
  }

  const adapter: StorageAdapter = {
    async getCard(id) {
      return cards.get(id) ?? null;
    },
    async listCards(query = {}) {
      listCalls += 1;
      if (gate) await gate;
      return [...cards.values()].filter(
        (card) => !query.deckId || card.deckId === query.deckId,
      );
    },
    async saveCard(card) {
      cards.set(card.id, card);
    },
    async saveCards(next) {
      for (const card of next) cards.set(card.id, card);
    },
    async deleteCard(id) {
      cards.delete(id);
    },
    async getDeck() {
      throw new Error('not used');
    },
    async listDecks() {
      throw new Error('not used');
    },
    async saveDeck() {
      throw new Error('not used');
    },
    async deleteDeck() {
      throw new Error('not used');
    },
    async saveReview(log) {
      reviews.push(log);
    },
    async listReviews() {
      return reviews;
    },
  };

  return { adapter, reviews, block, calls: () => listCalls };
}

/** The question currently on screen, whichever card the queue picked. */
function currentQuestion(): string | null {
  const face = document.querySelector('[data-recall-card-face][data-side="question"]');
  return face?.textContent ?? null;
}

function progress(): string | null {
  return document.querySelector('[data-recall-progress-text]')?.textContent ?? null;
}

describe('queue rebuilds', () => {
  it('builds a queue once the first load lands', async () => {
    const { adapter } = memoryAdapter(deck('a', ['one', 'two']));

    render(
      <SRSProvider adapter={adapter} deckId="a" scheduler={scheduler}>
        <StudyView />
      </SRSProvider>,
    );

    // Before the load resolves there is nothing to study, and the view must
    // say so rather than rendering an empty deck as "nothing due".
    expect(screen.getByText('Loading…')).toBeTruthy();

    await waitFor(() => expect(progress()).toBe('0 / 2'));
  });

  it('rebuilds from the new deck when deckId changes', async () => {
    const { adapter } = memoryAdapter([...deck('a', ['alpha']), ...deck('b', ['beta'])]);

    const { rerender } = render(
      <SRSProvider adapter={adapter} deckId="a" scheduler={scheduler}>
        <StudyView />
      </SRSProvider>,
    );

    await waitFor(() => expect(currentQuestion()).toContain('alpha'));

    rerender(
      <SRSProvider adapter={adapter} deckId="b" scheduler={scheduler}>
        <StudyView />
      </SRSProvider>,
    );

    // The regression: this used to keep showing "alpha" forever, because the
    // session had already decided it was seeded and never looked again.
    await waitFor(() => expect(currentQuestion()).toContain('beta'));
    expect(currentQuestion()).not.toContain('alpha');
  });

  it('never shows the previous deck while the next one loads', async () => {
    const { adapter, block } = memoryAdapter([
      ...deck('a', ['alpha']),
      ...deck('b', ['beta']),
    ]);

    const { rerender } = render(
      <SRSProvider adapter={adapter} deckId="a" scheduler={scheduler}>
        <StudyView />
      </SRSProvider>,
    );
    await waitFor(() => expect(currentQuestion()).toContain('alpha'));

    const finishLoad = block();
    await act(async () => {
      rerender(
        <SRSProvider adapter={adapter} deckId="b" scheduler={scheduler}>
          <StudyView />
        </SRSProvider>,
      );
    });

    // Deck B is asked for but has not arrived. The only honest thing to render
    // is "loading" -- deck A's card belongs to a deck the learner has left, and
    // showing it is the flash this behaviour exists to prevent.
    expect(document.body.textContent).not.toContain('alpha');
    expect(screen.getByText('Loading\u2026')).toBeTruthy();

    await act(async () => {
      finishLoad();
    });
    await waitFor(() => expect(currentQuestion()).toContain('beta'));
  });

  it('rebuilds when the adapter is swapped for one holding different data', async () => {
    const first = memoryAdapter(deck('a', ['before']));
    const second = memoryAdapter(deck('a', ['after']));

    const { rerender } = render(
      <SRSProvider adapter={first.adapter} deckId="a" scheduler={scheduler}>
        <StudyView />
      </SRSProvider>,
    );
    await waitFor(() => expect(currentQuestion()).toContain('before'));

    rerender(
      <SRSProvider adapter={second.adapter} deckId="a" scheduler={scheduler}>
        <StudyView />
      </SRSProvider>,
    );

    await waitFor(() => expect(currentQuestion()).toContain('after'));
  });
});

describe('queue survives grading', () => {
  it('advances through the queue instead of rebuilding it on every grade', async () => {
    const { adapter, reviews, calls } = memoryAdapter(deck('a', ['one', 'two', 'three']));

    render(
      <SRSProvider adapter={adapter} deckId="a" scheduler={scheduler}>
        <StudyView />
      </SRSProvider>,
    );
    await waitFor(() => expect(progress()).toBe('0 / 3'));

    const loadsBefore = calls();
    const order: string[] = [];

    for (let i = 0; i < 3; i += 1) {
      order.push(currentQuestion() ?? '');
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-recall-reveal]')?.click();
      });
      await act(async () => {
        // "Good": passes, so the card leaves the queue rather than coming back.
        document
          .querySelector<HTMLButtonElement>('[data-recall-rating][data-quality="4"]')
          ?.click();
      });
    }

    // Each card appeared exactly once. A queue rebuilding under the learner
    // would re-offer cards already graded, or reshuffle mid-sitting.
    expect(new Set(order).size).toBe(3);
    expect(reviews).toHaveLength(3);

    // And grading never sent the hook back to storage for a fresh card list.
    expect(calls()).toBe(loadsBefore);
  });
});
