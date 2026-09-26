# Deploying the docs site

The site lives in `packages/docs`, builds to a **static export**, and is hosted on
Cloudflare as Workers static assets at **https://recall-srs.sthabisod10.workers.dev**.

Static export (`output: 'export'` in `next.config.mjs`) is deliberate: everything here runs in
the browser (the playground executes FSRS against localStorage) and there are no API routes,
server actions or revalidation. The build is a folder of files any host will serve, so the site
is not tied to any one host.

One consequence: **no server-side features.** `app/docs/page.tsx` used `redirect()` and had to
become a real index page, which reads better than a redirect anyway. If you ever need a server
route, drop the export and move to a Worker script or a server host.

## Cloudflare

`wrangler.jsonc` at the repository root hosts `packages/docs/out` as **Workers static assets**
with no Worker script, so every request is served straight from the files and none of it is
billed. Cloudflare's dashboard now creates Workers rather than Pages projects; static assets are
the Workers equivalent of a Pages site.

Unknown paths get `out/404.html` (`not_found_handling: "404-page"`), and a path without its
trailing slash is redirected to the directory, which `trailingSlash: true` already expects.

### Connecting the repository

In the Cloudflare dashboard: **Workers & Pages → Create → Import a repository**, pick this repo,
then:

| Setting        | Value                                             |
| -------------- | ------------------------------------------------- |
| Project name   | `recall-srs`, matching `name` in `wrangler.jsonc` |
| Root directory | `/` (the repository root, not `packages/docs`)    |
| Build command  | leave empty                                       |
| Deploy command | `npx wrangler deploy`                             |

**The dashboard project name and `name` in `wrangler.jsonc` must match.** The dashboard's
builds deploy to the project's own Worker whatever the config says, but `npx wrangler deploy`
run by hand uses the config's name, and a mismatch quietly creates a second Worker on a
different URL.

The root directory is the repository root because the whole workspace has to be installed: the
site imports `@recall-srs/*` by name and Next transpiles them from source via
`transpilePackages`. Cloudflare's build image sees `pnpm-lock.yaml` and installs with pnpm.

`wrangler deploy` builds the site itself, through `build.command` in `wrangler.jsonc`, so the
dashboard build command is not needed. Anything set there runs first and just builds the site
twice. **Never set it to a bare `pnpm build`**: that builds only the libraries, and on its own
it fails the deploy with "The directory specified by the assets.directory field does not
exist".

Turn off **Builds for non-production branches** under **Settings → Build → Branch control**.
Only `main` deploys; PRs are covered by GitHub Actions.

### Deploying by hand

```bash
npx wrangler deploy     # builds the site, then uploads it
```

Run it from the repository root, not from `packages/docs`.

Current wrangler needs **Node 22**. Cloudflare's build image already has it. Locally, on Node
20, only an older wrangler runs, and it cannot start a Worker whose `compatibility_date` is
newer than it knows about, so preview with a date override (which does not touch the config).
It builds the site first too, and rebuilds when `app`, `components`, `lib` or `public` in
`packages/docs` change:

```bash
npx wrangler@4.86.0 dev --compatibility-date 2026-05-03
```

## Response headers

They are set in `packages/docs/public/_headers`. Next copies `public/` to the root of the
export, where Cloudflare reads the file and does not serve it.

| Header                                             | Why                                                                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Content-Type-Options: nosniff`                  | Files are only ever treated as the type they are served as.                                                                           |
| `Referrer-Policy: strict-origin-when-cross-origin` | Links out to GitHub and npm send the origin, never the full path.                                                                     |
| `Content-Type: image/png` on `/opengraph-image`    | The social card is exported with no file extension, so without this it is served as a generic binary and link previews show no image. |
| `Cache-Control` on `/opengraph-image`              | The card is regenerated on every build, and revalidating means a changed card shows up at once.                                       |

## After a domain change

Add a custom domain under the Worker's **Settings → Domains & Routes**, then update every place
that hardcodes the URL:

1. `metadataBase` and `openGraph.url` in `packages/docs/app/layout.tsx`. Without this, the
   Open Graph image resolves against the old host.
2. The host drawn on the social card in `packages/docs/app/opengraph-image.tsx`, **and** in its
   `GLYPHS` string. The card's font is subset to exactly those characters, so a new host with a
   letter that is not in the string renders that letter in the fallback font.
3. The links in the root `README.md` (the header, the demo GIF, the docs links) and the logo
   link at the top of every package README.
4. The repository homepage: `gh repo edit <owner>/<repo> --homepage "https://<new>"`.

The package READMEs are what npm shows on each package page, so npm only picks up the new links
at the next publish. Each package's `homepage` field points at the GitHub repository, not the
site, so it never needs changing.

Always load the new URL in a private window after changing it.

## Self-hosting instead

The export has no runtime requirements at all:

```bash
pnpm --filter @recall-srs/docs build
npx serve packages/docs/out
```

Any static host works: S3 behind CloudFront, GitHub Pages, nginx. `trailingSlash: true` means
every route is a directory with an `index.html`, so no host-specific rewrite rules are needed.
Only Cloudflare reads `_headers`; another host needs the headers, including the PNG content
type for `/opengraph-image`, set in its own config.
