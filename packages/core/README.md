# @recall-srs/core

The scheduling engine: FSRS and SM-2, the card and deck model, review queues and study sessions. Zero runtime dependencies, no React, no DOM.

Part of [Recall](https://github.com/Sthabiso10/recall-srs) — spaced repetition for React and
TypeScript, extracted from the study engine behind
[Korean Sunday](https://korean-sunday.vercel.app).

```bash
pnpm add @recall-srs/core
```

```ts
import { createCard, createFSRSScheduler } from '@recall-srs/core';

const scheduler = createFSRSScheduler({ desiredRetention: 0.9 });
const card = createCard({ question: '물', answer: 'water' });

const { card: updated, log } = scheduler.grade(card, 4);
scheduler.retrievabilityOf(updated); // recall probability, 0–1
```

Runs anywhere JavaScript does — browser, Node, React Native, a Convex function, a CLI.

[Documentation](https://github.com/Sthabiso10/recall-srs#readme) · [Algorithm details](https://github.com/Sthabiso10/recall-srs#why-fsrs)
