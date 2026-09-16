---
'@recall-srs/react': minor
---

`<StudyView>` now binds Space and Enter to reveal the answer, alongside the number keys
`<RatingButtons>` already bound to the grades. Without it a learner keyed the grade but
had to reach for the mouse to flip the card, which is the keystroke they make more than
any other.

Active only in default mode, and only while a card is on screen and still hidden, so it
can never fight the grade keys. It leaves the keystroke alone when a button, link or field
has focus, where both keys already mean "activate". Opt out with `revealShortcut={false}`;
a render prop owns its own keyboard and is unaffected either way.
