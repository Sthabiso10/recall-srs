# Deploying the docs site

The site lives in `packages/docs` and deploys to Vercel from the repository root.

`vercel.json` cannot carry comments — Vercel's schema rejects unknown keys — so the reasoning
for each setting is here instead:

| Setting | Why |
| --- | --- |
| `installCommand: pnpm install --frozen-lockfile` | Installs the **whole workspace**, not just `packages/docs`. The site imports `@recall-srs/*` by name and Next transpiles them from source via `transpilePackages`, so the library packages have to be present. |
| `buildCommand: pnpm --filter @recall-srs/docs build` | A bare `pnpm build` at the root builds the *libraries* and never touches the site. |
| `outputDirectory: packages/docs/.next` | Build runs from the root, so the output is not where Vercel would look by default. |
| `github.silent: true` | Suppresses the deployment-status comments Vercel posts on every commit. |

## Deploying

```bash
vercel deploy          # preview build, safe to run any time
vercel deploy --prod   # promote to the production domain
```

Both run from the repository root, not from `packages/docs`.

## After a domain change

If the production URL changes, update the link in the root `README.md` — the demo GIF should
link to the live playground.
