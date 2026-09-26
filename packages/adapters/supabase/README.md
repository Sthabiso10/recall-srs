<p align="center">
  <a href="https://recall-srs.sthabisod10.workers.dev">
    <img src="https://raw.githubusercontent.com/Sthabiso10/recall-srs/main/docs/media/logo.png" alt="Recall" width="280" />
  </a>
</p>

# @recall-srs/adapter-supabase

Supabase (Postgres) backend for Recall.

> [!WARNING]
> **Skeleton, not usable yet.** `schema.sql` is complete, but every adapter method
> throws `StorageError('... is not implemented yet.')`. Use
> [`@recall-srs/adapter-localstorage`](https://www.npmjs.com/package/@recall-srs/adapter-localstorage)
> today, or help finish this one. Contributions welcome.

Part of [Recall](https://github.com/Sthabiso10/recall-srs): spaced repetition for React and TypeScript.

```bash
pnpm add @recall-srs/adapter-supabase
```

```ts
import { createSupabaseAdapter } from '@recall-srs/adapter-supabase';

const adapter = createSupabaseAdapter({ client: supabase });
```

Ships `schema.sql` with tables, indexes and row-level security policies scoped to `auth.uid()`.
Run it once before first use. Pass your own configured client; the adapter never handles auth.

[Documentation](https://github.com/Sthabiso10/recall-srs#storage)
