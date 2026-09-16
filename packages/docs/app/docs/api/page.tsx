import type { Metadata } from 'next';
import { PageHeader, Prose } from '@/components/Prose';

export const metadata: Metadata = { title: 'API reference' };

/**
 * Hand-maintained for now. Once the API settles, generate this page from the
 * TSDoc comments (api-extractor or typedoc) so it cannot drift from the source.
 */

const CORE = [
  ['createCard(input, now?)', 'Build a valid Card with fresh scheduling state.'],
  ['createDeck(input, now?)', 'Build a deck with defaults filled in.'],
  [
    'createScheduler(config?)',
    'A scheduler with your tuning. Also exported as `scheduler`.',
  ],
  ['scheduler.grade(card, quality, opts?)', 'Apply a grade. Returns { card, log }.'],
  ['scheduler.preview(card, now?)', 'What each grade would schedule, for button labels.'],
  ['scheduler.isDue(card, now?, fuzzMs?)', 'Is this card reviewable right now?'],
  ['buildQueue({ cards, config, settings })', 'Select and order cards for one sitting.'],
  ['createStudySession(options)', 'Framework-free session object.'],
  ['computeDeckStats(cards, reviews)', 'Counts, due totals, retention, streak.'],
  ['computeForecast(cards, days?)', 'Upcoming workload, per day.'],
  ['computeRetentionCurve(reviews)', 'Recall rate bucketed by interval length.'],
];

const REACT = [
  ['<SRSProvider adapter deckId?>', 'Configures storage and scheduler; loads cards.'],
  ['<StudyView session? children?>', 'Flashcard UI, or a render prop for your own.'],
  ['<ProgressDashboard forecastDays?>', 'Stats, forecast and retention charts.'],
  ['<RatingButtons onRate preview?>', 'Grade buttons with interval hints.'],
  ['<CardFace card side render?>', 'One side of a card, with an optional renderer.'],
  ['useSRS()', 'Cards, due cards, CRUD, one-off grading.'],
  ['useStudySession(config?)', 'Session state: current card, reveal, grade, progress.'],
  ['useProgress(options?)', 'Stats, forecast and retention for the active deck.'],
];

export default function ApiPage() {
  return (
    <Prose>
      <PageHeader
        section="Reference"
        title="API reference"
        lead="Everything exported from the package roots. Anything not listed here is internal and may change in a patch release."
      />
      <h2>@recall-srs/core</h2>
      <ApiTable rows={CORE} />

      <h2>@recall-srs/react</h2>
      <ApiTable rows={REACT} />

      <h2>Storage adapters</h2>
      <p>
        All adapters implement the same <code>StorageAdapter</code> interface: ten methods
        covering cards, decks and review logs. See <a href="/docs/adapters">Adapters</a>.
      </p>
    </Prose>
  );
}

function ApiTable({ rows }: { rows: string[][] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {rows.map(([signature, description]) => (
        <div
          key={signature}
          className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] sm:items-baseline sm:gap-6"
        >
          <code className="font-mono text-sm text-foreground">{signature}</code>
          <p className="text-sm text-muted">{description}</p>
        </div>
      ))}
    </div>
  );
}
