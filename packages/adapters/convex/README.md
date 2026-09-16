<p align="center">
  <a href="https://recall-srs-docs.vercel.app">
    <img src="https://raw.githubusercontent.com/Sthabiso10/recall-srs/main/docs/media/logo.png" alt="Recall" width="280" />
  </a>
</p>

# @recall-srs/adapter-convex

Convex backend for Recall.

Part of [Recall](https://github.com/Sthabiso10/recall-srs): spaced repetition for React and TypeScript.

```bash
pnpm add @recall-srs/adapter-convex
```

```ts
import { createConvexAdapter } from '@recall-srs/adapter-convex';
import { api } from '../convex/_generated/api';

const adapter = createConvexAdapter({ client, api: api.recall });
```

Convex runs server functions rather than client queries, so this package ships `schema.ts` and
`recall.ts` for you to copy into your own `convex/` directory. Convex compiles them and
generates the typed `api`.

> **Status:** skeleton. Schema and indexes are done, function bodies are not. Contributions welcome.

[Documentation](https://github.com/Sthabiso10/recall-srs#storage)
