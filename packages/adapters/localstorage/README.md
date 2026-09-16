# @recall-srs/adapter-localstorage

Browser localStorage backend for Recall. Zero setup — no account, no schema, works offline.

Part of [Recall](https://github.com/Sthabiso10/recall-srs) — spaced repetition for React and TypeScript.

```bash
pnpm add @recall-srs/adapter-localstorage
```

```ts
import { createLocalStorageAdapter } from '@recall-srs/adapter-localstorage';

const adapter = createLocalStorageAdapter({ namespace: 'korean' });
```

Good for prototypes and local-first apps. Limits: ~5MB per origin, synchronous reads, and no
sync across devices. Swap to another adapter when you add accounts — the interface is identical.

[Documentation](https://github.com/Sthabiso10/recall-srs#storage)
