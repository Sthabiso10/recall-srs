# @recall-srs/adapter-firebase

Firebase Firestore backend for Recall.

Part of [Recall](https://github.com/Sthabiso10/recall-srs) — spaced repetition for React and TypeScript.

```bash
pnpm add @recall-srs/adapter-firebase
```

```ts
import { createFirebaseAdapter } from '@recall-srs/adapter-firebase';

const adapter = createFirebaseAdapter({ db: getFirestore(app), userId: user.uid });
```

Stores cards, decks and reviews as subcollections under each user, which keeps security rules
trivial. Watch per-document read costs on stats screens.

> **Status:** skeleton — the queries are not implemented yet. Contributions welcome.

[Documentation](https://github.com/Sthabiso10/recall-srs#storage)
