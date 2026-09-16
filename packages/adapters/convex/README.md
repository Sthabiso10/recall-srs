<p align="center">
  <a href="https://recall-srs-docs.vercel.app">
    <img src="https://raw.githubusercontent.com/Sthabiso10/recall-srs/main/docs/media/logo.png" alt="Recall" width="280" />
  </a>
</p>

# @recall-srs/adapter-convex

Convex backend for Recall.

> [!WARNING]
> **Skeleton, not usable yet.** The schema and indexes are done, but the function
> bodies are not implemented and throw. Use
> [`@recall-srs/adapter-localstorage`](https://www.npmjs.com/package/@recall-srs/adapter-localstorage)
> today, or help finish this one. Contributions welcome.

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

[Documentation](https://github.com/Sthabiso10/recall-srs#storage)
