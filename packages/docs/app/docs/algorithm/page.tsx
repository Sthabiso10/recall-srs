import type { Metadata } from 'next';
import { CodeBlock } from '@/components/CodeBlock';
import { Prose } from '@/components/Prose';

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

const R = `const scheduler = createFSRSScheduler();

// "How likely am I to remember this right now?" — 0 to 1.
scheduler.retrievabilityOf(card);

// Sort a queue by what you're closest to forgetting.
cards.sort((a, b) => scheduler.retrievabilityOf(a) - scheduler.retrievabilityOf(b));`;

export default function AlgorithmPage() {
  return (
    <Prose>
      <h1>The algorithm</h1>
      <p>
        Recall ships two schedulers behind one interface. <strong>FSRS</strong> models the
        forgetting curve directly and is what you should use for new projects.{' '}
        <strong>SM-2</strong> is the classic SuperMemo algorithm, included for
        compatibility with existing decks and for apps that want something simple and
        well understood.
      </p>
      <p>
        Switching is one line, and needs no data migration — FSRS keeps its state in a
        field SM-2 ignores.
      </p>
      <CodeBlock code={SWITCH} language="tsx" />

      <h2>Why FSRS</h2>
      <p>
        SM-2 multiplies the interval by an &ldquo;ease factor&rdquo; and hopes. FSRS models
        memory with three quantities — stability, difficulty and retrievability — which
        lets it answer a question SM-2 cannot even express: <em>what interval gives me a
        90% chance of recall?</em>
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
        FSRS can tell you the current recall probability of any card — useful for sorting a
        queue by what is most at risk, or for showing a learner why a card resurfaced.
      </p>
      <CodeBlock code={R} language="ts" />

      <h2>Grading</h2>
      <p>
        Both schedulers take an SM-2 quality from 0 to 5. FSRS uses four grades internally,
        so the scales are mapped:
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
      <p>
        The mapping is lossy on purpose: 0, 1 and 2 are indistinguishable to FSRS. If
        you&apos;re running FSRS, show four buttons rather than six — the default UI
        already does.
      </p>
      <CodeBlock code={GRADE} language="ts" />
      <p>
        <code>grade()</code> is pure on both schedulers: it returns a new card and a review
        log, and never mutates the input. Persisting both is the caller&apos;s job.
      </p>

      <h2>Tuning FSRS to your learners</h2>
      <p>
        FSRS uses 19 fitted weights. The defaults are population-level starting values —
        the algorithm is designed to have them <em>optimised per user</em> from their own
        review history. That optimiser is not built in yet; when you add it, the review log
        is the training data, which is the reason it is append-only.
      </p>

      <h2>SM-2, if you need it</h2>
      <p>
        <code>createScheduler()</code> gives you classic SM-2: learning steps of one day
        then six, intervals multiplied by an ease factor that starts at 2.5 and floors at
        1.3, and a reset to relearning on any grade below 3. Use it if you are migrating a
        deck that already has SM-2 history and you want identical behaviour.
      </p>

      <h2>Writing your own</h2>
      <p>
        Both schedulers implement the same <code>Scheduler</code> interface — six methods.
        Nothing above that layer knows which algorithm is running, so a third one is a new
        module rather than a rewrite.
      </p>
    </Prose>
  );
}
