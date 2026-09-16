import type { Metadata } from 'next';
import { CodeBlock } from '@/components/CodeBlock';
import { Callout, PageHeader, Prose } from '@/components/Prose';

export const metadata: Metadata = { title: 'Algorithm' };

const SWITCH = `import { createFSRSScheduler } from '@recall-srs/core';
import { SRSProvider } from '@recall-srs/react';

const scheduler = createFSRSScheduler({ desiredRetention: 0.9 });

<SRSProvider adapter={adapter} scheduler={scheduler}>
  <StudyView />
</SRSProvider>`;

const RETENTION = `// The one knob your learners actually feel.
createFSRSScheduler({ desiredRetention: 0.95 }); // shorter intervals, more reviews/day
createFSRSScheduler({ desiredRetention: 0.85 }); // longer intervals, fewer reviews/day`;

const GRADE = `const { card: updated, log } = scheduler.grade(card, 4);

await adapter.saveCard(updated);
await adapter.saveReview(log);   // append-only history`;

const OPTIMIZE = `import { optimizeFSRSWeights } from '@recall-srs/core/optimizer';

const result = await optimizeFSRSWeights(await adapter.listReviews());

if (result.recommendation === 'adopt') {
  const scheduler = createFSRSScheduler({ weights: result.weights });
} else {
  console.log(result.reason); // plain language, safe to show a user
}`;

const R = `const scheduler = createFSRSScheduler();

// "How likely am I to remember this right now?" Returns 0 to 1.
scheduler.retrievabilityOf(card);

// Sort a queue by what you're closest to forgetting.
cards.sort((a, b) => scheduler.retrievabilityOf(a) - scheduler.retrievabilityOf(b));`;

export default function AlgorithmPage() {
  return (
    <Prose>
      <PageHeader
        section="Concepts"
        title="The algorithm"
        lead="FSRS models the forgetting curve and solves for the interval that hits your retention target. SM-2 is scaffolded behind the same interface, but is not implemented yet."
      />
      <p>
        Recall is built around <strong>FSRS</strong>, which models the forgetting curve
        directly. It is the only scheduler you can run today and the one you should use.{' '}
        <strong>SM-2</strong> is scaffolded behind the same interface but is{' '}
        <strong>not implemented</strong>: <code>createScheduler()</code> throws rather
        than return a plausible-looking wrong interval.
      </p>
      <p>
        When it lands, switching will be one line and need no data migration, because FSRS
        keeps its state in a field SM-2 ignores.
      </p>
      <CodeBlock code={SWITCH} language="tsx" />

      <h2>Why FSRS</h2>
      <p>
        SM-2 multiplies the interval by an &ldquo;ease factor&rdquo; and hopes. FSRS
        models memory with three quantities (stability, difficulty and retrievability),
        which lets it answer a question SM-2 cannot even express:{' '}
        <em>what interval gives me a 90% chance of recall?</em>
      </p>
      <p>Two consequences worth understanding:</p>
      <ul>
        <li>
          <strong>Elapsed time is evidence.</strong> FSRS uses how long it actually was
          since your last review. Recalling a card you were about to forget tells the
          model far more than recalling one you saw yesterday, and it schedules
          accordingly. SM-2 discards that information entirely.
        </li>
        <li>
          <strong>Retention is a setting, not an outcome.</strong> You pick the target and
          the scheduler solves for the interval.
        </li>
      </ul>
      <CodeBlock code={RETENTION} language="ts" />
      <p>
        Raising the target to 0.95 roughly doubles daily workload; dropping to 0.85 trades
        accuracy for time. Exposing this slider to learners is worth more than any amount
        of parameter tuning.
      </p>

      <h2>Retrievability</h2>
      <p>
        FSRS can tell you the current recall probability of any card, which is useful for
        sorting a queue by what is most at risk, or for showing a learner why a card
        resurfaced.
      </p>
      <CodeBlock code={R} language="ts" />

      <h2>Grading</h2>
      <p>
        The <code>Scheduler</code> interface takes an SM-2 quality from 0 to 5. FSRS uses
        four grades internally, so the scales are mapped:
      </p>
      <table>
        <thead>
          <tr>
            <th>Quality</th>
            <th>Meaning</th>
            <th>FSRS rating</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['0', 'Total blackout', 'Again'],
            ['1', 'Wrong, but familiar', 'Again'],
            ['2', 'Wrong, tip of the tongue', 'Again'],
            ['3', 'Correct, after serious effort', 'Hard'],
            ['4', 'Correct, after hesitation', 'Good'],
            ['5', 'Instant, perfect recall', 'Easy'],
          ].map(([quality, meaning, rating]) => (
            <tr key={quality}>
              <td>{quality}</td>
              <td>{meaning}</td>
              <td>{rating}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Callout title="Four buttons, not six">
        The mapping is lossy on purpose: 0, 1 and 2 are indistinguishable to FSRS. If
        you&apos;re running FSRS, show four grades rather than six. The default UI already
        does.
      </Callout>
      <CodeBlock code={GRADE} language="ts" />
      <p>
        <code>grade()</code> is pure on every scheduler: it returns a new card and a
        review log, and never mutates the input. Persisting both is the caller&apos;s job.
      </p>

      <h2>Tuning FSRS to your learners</h2>
      <p>
        FSRS uses 19 fitted weights. The defaults are population-level starting values,
        and the algorithm is designed to have them <em>optimised per user</em> from their
        own review history. That optimiser ships in{' '}
        <code>@recall-srs/core/optimizer</code>, a separate entry point so a study screen
        never bundles the fitting code.
      </p>
      <CodeBlock code={OPTIMIZE} language="ts" />
      <Callout title="Keeping the defaults is a success">
        It holds out a fifth of the cards, trains on the rest, and reports whether the fit
        predicts the held-out cards better than the weights it started from. Below roughly
        400 reviews it refuses to run and tells you why: fitting nineteen parameters to
        thin history describes the past beautifully and predicts the future worse than the
        defaults did. The review log is the training data, which is why{' '}
        <code>saveReview</code> is append-only from day one.
      </Callout>

      <h2>SM-2, once it exists</h2>
      <p>
        <code>createScheduler()</code> is reserved for classic SM-2: learning steps of one
        day then six, intervals multiplied by an ease factor that starts at 2.5 and floors
        at 1.3, and a reset to relearning on any grade below 3. It is{' '}
        <strong>not implemented yet and throws</strong>, so that a deck never quietly
        schedules on maths that is not there. It is tracked as a good first issue.
      </p>

      <h2>Writing your own</h2>
      <p>
        Every scheduler implements the same six-method <code>Scheduler</code> interface.
        Nothing above that layer knows which algorithm is running, so another one is a new
        module rather than a rewrite.
      </p>
    </Prose>
  );
}
