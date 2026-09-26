<p align="center">
  <a href="https://recall-srs.sthabisod10.workers.dev">
    <img src="https://raw.githubusercontent.com/Sthabiso10/recall-srs/main/docs/media/logo.png" alt="Recall" width="280" />
  </a>
</p>

# @recall-srs/adapter-firebase

Firebase Firestore backend for Recall.

> [!WARNING]
> **Skeleton, not usable yet.** The subcollection layout is defined, but every adapter
> method throws `StorageError('... is not implemented yet.')`. Use
> [`@recall-srs/adapter-localstorage`](https://www.npmjs.com/package/@recall-srs/adapter-localstorage)
> today, or help finish this one. Contributions welcome.

Part of [Recall](https://github.com/Sthabiso10/recall-srs): spaced repetition for React and TypeScript.

```bash
pnpm add @recall-srs/adapter-firebase
```

```ts
import { createFirebaseAdapter } from '@recall-srs/adapter-firebase';

const adapter = createFirebaseAdapter({ db: getFirestore(app), userId: user.uid });
```

Stores cards, decks and reviews as subcollections under each user, which keeps security rules
trivial. Watch per-document read costs on stats screens.

[Documentation](https://github.com/Sthabiso10/recall-srs#storage)
