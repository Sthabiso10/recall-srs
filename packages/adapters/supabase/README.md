# @recall-srs/adapter-supabase

Supabase (Postgres) backend for Recall.

Part of [Recall](https://github.com/Sthabiso10/recall-srs) — spaced repetition for React and TypeScript.

```bash
pnpm add @recall-srs/adapter-supabase
```

```ts
import { createSupabaseAdapter } from '@recall-srs/adapter-supabase';

const adapter = createSupabaseAdapter({ client: supabase });
```

Ships `schema.sql` with tables, indexes and row-level security policies scoped to `auth.uid()`.
Run it once before first use. Pass your own configured client — the adapter never handles auth.

> **Status:** the schema is complete; the queries are still skeletons. Contributions welcome.

[Documentation](https://github.com/Sthabiso10/recall-srs#storage)
