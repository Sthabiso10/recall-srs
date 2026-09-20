# @recall-srs/react

## 0.4.0

### Minor Changes

- 36a3130: Fix a study session holding a queue built from cards that are no longer there.

  `useStudySession` latched onto the first non-empty load and never rebuilt after it, so
  anything that replaced the card set afterwards left the learner grading the old one.
  Switching `deckId` kept the previous deck's queue; so did swapping the adapter, and so did
  an explicit `refresh()` after a bulk import. The queue could only be reset by remounting
  the provider, which is what apps hitting this ended up doing.

  `<SRSProvider>` now exposes `cardsVersion` on its context: a counter that moves once per
  completed load and never on a grade. That is the distinction the hook was missing. `cards`
  is a new Map after every single review, so its identity cannot tell "the learner graded a
  card" apart from "these are different cards now". The first must not rebuild the queue;
  the second must. Sessions key on `cardsVersion`, so both cases are now handled, and
  grading still leaves the queue alone.

  The provider also no longer hands out the previous deck's cards while the next deck loads.
  `deckId` changes during render but the load answering it lands a round trip later, and in
  that window the old deck's cards were served as though they were the new deck's, flashing a
  card the learner had just navigated away from. It now reports `loading` until its cards
  match the deck being asked for. `autoLoad={false}` is unaffected.

- afad83b: `<StudyView>` now binds Space and Enter to reveal the answer, alongside the number keys
  `<RatingButtons>` already bound to the grades. Without it a learner keyed the grade but
  had to reach for the mouse to flip the card, which is the keystroke they make more than
  any other.

  Active only in default mode, and only while a card is on screen and still hidden, so it
  can never fight the grade keys. It leaves the keystroke alone when a button, link or field
  has focus, where both keys already mean "activate". Opt out with `revealShortcut={false}`;
  a render prop owns its own keyboard and is unaffected either way.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @recall-srs/core@0.3.0

## 0.3.0

### Minor Changes

- Localise the default components.

  The engine was always language-agnostic — `question` and `answer` are opaque strings the
  scheduler never reads — but the components shipped hardcoded English, so translating the UI
  meant abandoning them for a render prop.

  - `<RecallIntl locale strings>` sets language and number formatting for the whole tree.
    `strings` is a deep partial, so overriding three keys leaves the rest English rather than
    blank.
  - `<StudyView>` gains `revealLabel`, `skipLabel` and `restartLabel` for one-off wording.
  - Intervals, percentages and counts go through `Intl`, so `locale` alone produces "3 j",
    "3 dias" and the right decimal separator without a translation table in this package.

  Backward compatible: with no provider, components use English and the runtime locale exactly
  as before. An invalid locale degrades to English instead of throwing mid-render.

  The patch bumps on the other packages carry README updates only — no code changes.

### Patch Changes

- Updated dependencies
  - @recall-srs/core@0.2.1

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
