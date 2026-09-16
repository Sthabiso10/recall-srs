# Deploying the docs site

The site lives in `packages/docs`, builds to a **static export**, and deploys to Vercel from
the repository root.

Static export (`output: 'export'` in `next.config.mjs`) is deliberate: everything here runs in
the browser — the playground executes FSRS against localStorage — and there are no API routes,
server actions or revalidation. The build is a folder of files any host will serve, so the site
is not tied to Vercel. It also sidesteps Vercel's framework detection, which looks for `next`
in the *root* `package.json` and does not find it in a monorepo unless you set the project's
Root Directory, which cannot be done from `vercel.json` or the CLI.

One consequence: **no server-side features.** `app/docs/page.tsx` used `redirect()` and had to
become a real index page — which reads better than a redirect anyway. If you ever need a server
route, you will need to set Root Directory to `packages/docs` in the Vercel dashboard and drop
the export.

`vercel.json` cannot carry comments — Vercel's schema rejects unknown keys — so the reasoning
for each setting is here instead:

| Setting | Why |
| --- | --- |
| `installCommand: pnpm install --frozen-lockfile` | Installs the **whole workspace**, not just `packages/docs`. The site imports `@recall-srs/*` by name and Next transpiles them from source via `transpilePackages`, so the library packages have to be present. |
| `buildCommand: pnpm --filter @recall-srs/docs build` | A bare `pnpm build` at the root builds the *libraries* and never touches the site. |
| `outputDirectory: packages/docs/out` | Build runs from the root, so the output is not where Vercel would look by default. |
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
