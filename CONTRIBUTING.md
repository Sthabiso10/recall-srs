# Contributing to Recall

Thanks for looking. Issues and PRs are both welcome, and the [Status table in the
README](README.md#status) is the honest list of what needs doing.

## Getting set up

```bash
pnpm install
pnpm -r test        # Jest
pnpm -r typecheck   # tsc --noEmit
pnpm docs           # docs site + playground on :3000
```

Workspace packages resolve to `src/` during development, so there's no build step before
tests and library edits hot-reload in the docs site. `pnpm build` produces the bundles that
get published.

**One consequence worth knowing:** because `@recall-srs/core` points at TypeScript source
in this repo, plain `node` can't import it, so you'll get `ERR_UNKNOWN_FILE_EXTENSION`. Anything
running through a bundler (the docs site, Jest, Vite, Next) is fine. Scripts run by bare Node
need `pnpm build` first and should import from `dist/`, which is what `examples/minimal` does.

```bash
pnpm size          # bundle budgets, enforced in CI
pnpm --filter @recall-srs/example-minimal start   # the engine in ~50 lines of Node
```

## Where things live

```
packages/core/src/algorithm/   the schedulers: pure functions, no clock, no storage
packages/core/src/session/     queue building and study sessions
packages/core/src/stats/       everything derived from cards + review logs
packages/react/                components and hooks, no scheduling logic
packages/adapters/*/           storage backends
```

Three rules the codebase holds to, and PRs are reviewed against:

1. **Scheduling functions are pure.** They take state and return new state. No clock reads,
   no storage writes, no mutation of inputs. Time comes in through the `Clock` port so tests
   can fast-forward three months without waiting.
2. **Review logs are append-only.** Scheduling state is a cache of the latest review; the log
   is the history every statistic derives from, and eventually the FSRS weight optimiser's
   training data. Nothing overwrites or deletes it, `deleteCard` included.
3. **The view layer owns no logic.** If you're computing an interval inside a `.tsx` file, it
   belongs in the core.

## Changing the algorithm

This is the part where mistakes are hardest to notice, so it gets extra care.

**Say what happens to intervals.** In the PR, state what a card graded Good five times in a
row schedules before and after your change. A regression here looks like nothing in a diff
and shows up six months later as a learner who forgot everything.

**Make sure the feature reaches the real path.** The relearning ladder was added, unit
tested, and completely inert in practice for a full release cycle: sessions build their queue
once at construction, so a card scheduled ten minutes out was never shown again. Test through
`createStudySession`, not just the scheduler, and run `examples/minimal` to see it end to end.

**Previews must match reality.** `scheduler.preview()` runs the real scheduling path rather
than recomputing intervals, because a version that recomputed advertised "Again · 580m" while
grading Again actually scheduled 10 minutes. If you change scheduling, the preview test
catches the drift. Keep it that way.

**Test invariants, not numbers.** `test/fsrs.test.ts` asserts things like "stability never
increases after a lapse" and "recalling an overdue card is worth more than recalling a fresh
one". Those survive re-fitted weights; hard-coded expected intervals don't.

**One exception:** `retrievability(S, S) === 0.9` is asserted exactly. That identity is the
definition of stability. If it breaks, the model no longer means what it says.

**Never ship a scheduler that silently does the wrong thing.** SM-2 currently throws
`NotImplementedError` at construction, because an earlier version returned plausible-looking
values that collapsed every card to a one-day interval. A library that refuses to run is
recoverable; one that quietly mis-schedules is not.

## Writing a storage adapter

New backends are very welcome. Read `packages/adapters/localstorage/src/index.ts` first, because it's
the reference implementation, about 200 lines, and its test file is the contract every adapter
owes.

Four rules:

- Every method async, even when the backend is synchronous
- `saveReview` appends; it never updates
- Plain JSON-safe data in and out, no class instances
- Throw `StorageError` on failure. Never return `[]`, because a silently empty deck reads as
  "you're done!" to a learner

## Accessibility

This is an education library, so it gets used by people who need assistive technology. Content
that changes in place (revealing an answer) needs an `aria-live` region, interactive elements
need accessible names, and anything reachable by mouse needs a keyboard path. PRs that add UI
should keep that true.

## Versioning

We use [changesets](https://github.com/changesets/changesets). If you changed a published
package:

```bash
pnpm changeset
```

Pick the packages and the bump type, and write the changelog entry in terms of what a user
notices, not what the diff did.

Everything is `0.x`, so breaking changes are allowed, but they should be deliberate and
explained in the changeset.

## Releasing

Nobody publishes from a laptop. `.github/workflows/release.yml` handles it in two phases:

1. Merging a PR that carries changeset files makes the workflow open a **"chore(release):
   version packages"** PR — versions bumped, CHANGELOGs written, changesets consumed.
   Nothing reaches npm yet.
2. Merging *that* PR leaves a `main` with no changesets pending, so the workflow builds,
   verifies and runs `changeset publish`, then pushes the git tags.

So the release is itself a code review: the version PR is where you check the bumps and the
changelog before anything becomes permanent. npm publishes can only be undone within 72
hours, and the version number is burned either way.

The workflow re-runs typecheck, lint, tests, the build, the size budgets and the `use client`
check before publishing. That duplicates CI on the same commit deliberately — the release path
verifies for itself rather than trusting a green tick that may belong to a different run.

Published tarballs carry [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
which ties each one back to the workflow run and commit that produced it.

### Publishing is opt-in

Phase 1 needs nothing but Settings → Actions → General → **Allow GitHub Actions to create
and approve pull requests**. Without that, the workflow cannot open the version PR.

Phase 2 needs an `NPM_TOKEN` repository secret — an npm **automation** token, or a granular
token scoped to `@recall-srs` with read/write. Either way it must bypass 2FA; a classic
"publish" token prompts for a one-time code and hangs the job.

**There is no token configured today, and that is a supported state.** The workflow checks
for the secret and, when it is missing, versions without publishing and leaves a notice on
the run rather than failing. So right now you get automated version PRs, and the publish
itself is still manual:

```bash
npm login
pnpm release
git push --follow-tags
```

Add the secret whenever you want and publishing turns itself on — no change to the workflow.

Worth knowing about tokens: they expire, and when one does the publish starts failing with a
401 that does not explain itself. [Trusted publishing](https://docs.npmjs.com/trusted-publishers)
via OIDC removes the secret entirely and has nothing to rotate, which is where this should end
up. It needs `@changesets/cli` 3.x first: 2.x crashes publishing under OIDC, and separately
mis-parses `npm info --json` on npm 12.

The root script is `version-packages`, not `version`, because npm treats `version` as a
lifecycle hook and would run it during `npm version`.

## Before you open the PR

```bash
pnpm -r typecheck && pnpm lint && pnpm -r test && pnpm build
```

CI runs the same on Node 18, 20 and 22, plus a check that the `use client` directive survived
into the published React bundle.
