<p align="center">
  <a href="https://recall-srs.sthabisod10.workers.dev">
    <img src="https://raw.githubusercontent.com/Sthabiso10/recall-srs/main/docs/media/logo.png" alt="Recall" width="280" />
  </a>
</p>

# @recall-srs/react

Headless-first React components and hooks for Recall.

Part of [Recall](https://github.com/Sthabiso10/recall-srs): spaced repetition for React and TypeScript.

```bash
pnpm add @recall-srs/react
```

```tsx
import { SRSProvider, StudyView } from '@recall-srs/react';

<SRSProvider adapter={adapter} deckId="korean-101">
  <StudyView session={{ limit: 20 }} />
</SRSProvider>;
```

Components ship semantic and unstyled with `data-*` hooks, or pass a render prop and own the
markup entirely. Hooks: `useSRS()`, `useStudySession()`, `useProgress()`.

Requires `@recall-srs/core` and React 18+.

[Documentation](https://github.com/Sthabiso10/recall-srs#readme)
