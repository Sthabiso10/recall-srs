/**
 * The smallest complete Recall app: a study session in a terminal.
 *
 * No React, no bundler, no database — just the engine. Run it with:
 *
 *     node examples/minimal/index.mjs
 *
 * If you are contributing to the scheduler, this is the fastest way to see a
 * change end to end. It prints what each grade would schedule, which is usually
 * enough to tell whether a change did what you meant.
 */

// In YOUR project this line is simply:
//
//     import { createCard, createFSRSScheduler, createStudySession } from '@recall-srs/core';
//
// Inside this repo the package resolves to TypeScript source (so library edits
// hot-reload in the docs site), which plain Node cannot load — so this example
// imports the built output instead. `pnpm start` builds it first.
import {
  createCard,
  createFSRSScheduler,
  createStudySession,
} from '../../packages/core/dist/index.js';

const scheduler = createFSRSScheduler({ desiredRetention: 0.9 });

const cards = [
  ['물', 'water'],
  ['불', 'fire'],
  ['하늘', 'sky'],
].map(([question, answer]) => createCard({ question, answer, tags: ['noun'] }));

const session = createStudySession({
  cards,
  scheduler,
  onReview: ({ card, log }) => {
    // This is where you would persist. An adapter does exactly this much.
    console.log(
      `    saved: quality ${log.quality} -> next in ${card.scheduling.interval.toFixed(2)}d`,
    );
  },
});

console.log(`Studying ${session.remaining()} cards.\n`);

while (session.remaining() > 0) {
  const card = session.getCurrentCard();
  if (!card) break;

  console.log(`  Q: ${card.question}`);
  session.reveal();
  console.log(`  A: ${card.answer}`);

  // What each button would say in a real UI. This preview is the single most
  // useful thing to show a learner before they grade.
  const preview = scheduler.preview(card);
  const options = [1, 3, 4, 5]
    .map((q) => `${['', 'Again', '', 'Hard', 'Good', 'Easy'][q]} ${format(preview[q].intervalDays)}`)
    .join('  |  ');
  console.log(`     ${options}`);

  // Pretend the learner pressed Good.
  await session.grade(4);
  console.log();
}

const summary = await session.end();
console.log(
  `Done: ${summary.cardsReviewed} reviewed, ${Math.round(summary.accuracy * 100)}% recalled.`,
);

function format(days) {
  if (days < 1) return `${Math.round(days * 24 * 60)}m`;
  if (days < 30) return `${Math.round(days)}d`;
  return `${(days / 30).toFixed(1)}mo`;
}
