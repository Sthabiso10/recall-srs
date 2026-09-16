---
'@recall-srs/react': minor
---

Fix a study session holding a queue built from cards that are no longer there.

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
