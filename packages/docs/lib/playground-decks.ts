/**
 * The decks the playground ships with.
 *
 * Three of them, and the variety is the point. Spaced repetition only
 * demonstrates itself when the learner can *honestly* grade. A visitor who has
 * never seen 빠르다 has one truthful answer for every card ("Again"), which
 * means every interval preview reads the same and the algorithm looks like a
 * timer. Give them capitals and JavaScript trivia alongside it and the grades
 * spread out, the intervals diverge, and the forecast has a shape.
 *
 * Eight cards each: enough to fill a sitting, few enough to finish one.
 */

export type DeckKey = 'korean' | 'capitals' | 'javascript';

export interface DemoCard {
  question: string;
  answer: string;
  category: string;
}

export interface DemoDeck {
  key: DeckKey;
  /** Storage `deckId`. Prefixed so it cannot collide with a visitor's own data. */
  id: string;
  name: string;
  /** One line under the tabs, telling you what you are about to be asked. */
  blurb: string;
  tag: string;
  cards: DemoCard[];
}

export const DECKS: DemoDeck[] = [
  {
    key: 'capitals',
    id: 'playground-capitals',
    name: 'World capitals',
    blurb: 'Eight you half know, which is what makes the grades differ.',
    tag: 'geography',
    cards: [
      { question: 'Australia', answer: 'Canberra', category: 'Oceania' },
      { question: 'Brazil', answer: 'Brasília', category: 'South America' },
      { question: 'Canada', answer: 'Ottawa', category: 'North America' },
      { question: 'Switzerland', answer: 'Bern', category: 'Europe' },
      { question: 'Türkiye', answer: 'Ankara', category: 'Asia' },
      { question: 'Vietnam', answer: 'Hanoi', category: 'Asia' },
      { question: 'Morocco', answer: 'Rabat', category: 'Africa' },
      { question: 'New Zealand', answer: 'Wellington', category: 'Oceania' },
    ],
  },
  {
    key: 'javascript',
    id: 'playground-javascript',
    name: 'JavaScript trivia',
    blurb: 'Written for the audience actually reading these docs.',
    tag: 'javascript',
    cards: [
      {
        question: 'typeof null',
        answer: '"object", a 1995 bug kept for compatibility',
        category: 'types',
      },
      {
        question: '0.1 + 0.2 === 0.3',
        answer: 'false. IEEE 754 binary floats cannot hold 0.1 exactly',
        category: 'numbers',
      },
      {
        question: 'NaN === NaN',
        answer: 'false. Use Number.isNaN() or Object.is()',
        category: 'numbers',
      },
      {
        question: 'What does [].sort() compare by default?',
        answer: 'The string form of each element, so [10, 9, 1] sorts to [1, 10, 9]',
        category: 'arrays',
      },
      {
        question: 'What does const actually prevent?',
        answer: 'Reassigning the binding, never the value it holds',
        category: 'scope',
      },
      {
        question: 'Promise.all vs Promise.allSettled',
        answer:
          'all rejects on the first rejection; allSettled always resolves, one outcome per promise',
        category: 'async',
      },
      {
        question: '[] + {}',
        answer:
          '"[object Object]". + coerces both to primitives first, then concatenates',
        category: 'coercion',
      },
      {
        question: 'What is the value of this in an arrow function?',
        answer:
          'Whatever it was in the enclosing scope. Arrows have no this of their own',
        category: 'scope',
      },
    ],
  },
  {
    key: 'korean',
    id: 'playground-korean',
    name: 'Korean 101',
    blurb: 'New material, for watching a card you keep failing come back.',
    tag: 'korean',
    cards: [
      { question: '물', answer: 'water', category: 'noun' },
      { question: '불', answer: 'fire', category: 'noun' },
      { question: '산', answer: 'mountain', category: 'noun' },
      { question: '하늘', answer: 'sky', category: 'noun' },
      { question: '먹다', answer: 'to eat', category: 'verb' },
      { question: '가다', answer: 'to go', category: 'verb' },
      { question: '크다', answer: 'to be big', category: 'adjective' },
      { question: '빠르다', answer: 'to be fast', category: 'adjective' },
    ],
  },
];

export const DEFAULT_DECK: DeckKey = 'capitals';

export function deckFor(key: DeckKey): DemoDeck {
  return DECKS.find((deck) => deck.key === key) ?? DECKS[0]!;
}
