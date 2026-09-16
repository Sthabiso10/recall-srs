# Examples

| Example | What it shows |
| --- | --- |
| [`minimal/`](minimal) | The engine on its own: a study session in ~50 lines of Node, no React, no storage. Run with `pnpm --filter @recall-srs/example-minimal start`. |

The docs site's [playground](../packages/docs/components/Playground.tsx) is the React
equivalent: provider, components and the localStorage adapter wired together. Run it with
`pnpm docs` and open `/playground`.

## Contributing an example

Keep them small and runnable from a clean clone with one command. An example that needs API
keys or a database belongs in the docs as a guide, not here.
