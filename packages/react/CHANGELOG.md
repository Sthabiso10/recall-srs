# @recall-srs/react

## 0.2.0

### Minor Changes

- 79714ff: Review pass over the first release: scheduling correctness fixes, new analytics, and the
  first tests for the localStorage adapter. See CHANGELOG.md for the full list.

  Behaviour changes worth knowing before upgrading:

  - `createScheduler()` (SM-2) now throws — it was silently scheduling every card at a fixed
    one-day interval. Use `createFSRSScheduler()`.
  - FSRS is now the default scheduler in `createStudySession()` and `<SRSProvider>`.
  - Lapsed cards enter a ten-minute relearning ladder instead of disappearing until tomorrow.
  - Due dates anchor to the start of the study day (configurable `dayStartsAtHour`).
  - `maximumIntervalDays` defaults to 365, down from 3650.
  - `<SRSProvider>`'s `schedulerConfig` prop is now `fsrsConfig`.

  Second review pass:

  - The relearning ladder now actually works inside a session — it was inert, because sessions
    build their queue once at construction.
  - `preview()` runs the real scheduling path, so button labels match what grading does.
  - Invalid FSRS config throws instead of silently mixing FSRS-4.5 and FSRS-5 weights.
  - Added `resumeStudySession()`, `applyLoadBalance()`, `session.reclaim()` and
    `awaitingRelearning`.

  Adds the FSRS weight optimiser at `@recall-srs/core/optimizer` — fit the 19 parameters to a
  learner's own review history, with a held-out validation set and an honest recommendation
  about whether the result is worth adopting.

### Patch Changes

- Updated dependencies [79714ff]
  - @recall-srs/core@0.2.0
