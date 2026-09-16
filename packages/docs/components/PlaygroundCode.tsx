'use client';

/**
 * The code the playground is currently running.
 *
 * A library's playground that you can only *use* is a demo. This panel is what
 * makes it a playground: change a control above and the snippet changes with
 * it, so the thing you just tuned by clicking is also the thing you can copy
 * into your editor.
 *
 * It is generated from the same settings object the components are given, so it
 * cannot drift from what is on screen.
 */

import { CodeBlock } from './CodeBlock';
import { deckFor } from '@/lib/playground-decks';
import type { PlaygroundSettings } from '@/lib/playground-settings';

export function PlaygroundCode({
  settings,
  namespace,
}: {
  settings: PlaygroundSettings;
  namespace: string;
}) {
  return (
    <CodeBlock
      code={buildSnippet(settings, namespace)}
      language="tsx"
      filename="study.tsx"
    />
  );
}

function buildSnippet(settings: PlaygroundSettings, namespace: string): string {
  const deck = deckFor(settings.deck);
  const localised = settings.locale !== 'en';

  // Everything inside `return (` starts two levels in, and the provider drops
  // one level further when <RecallIntl> wraps it. Computing the indent rather
  // than hardcoding it is what keeps this paste-able instead of merely
  // illustrative.
  const indent = localised ? '      ' : '    ';

  const imports = [
    `import { createLocalStorageAdapter } from '@recall-srs/adapter-localstorage';`,
    `import {`,
    `  ProgressDashboard,`,
    ...(localised ? [`  RecallIntl,`] : []),
    `  SRSProvider,`,
    `  StudyView,`,
    `} from '@recall-srs/react';`,
  ].join('\n');

  const provider = [
    `${indent}<SRSProvider`,
    `${indent}  adapter={adapter}`,
    `${indent}  deckId="${deck.id}"`,
    `${indent}  fsrsConfig={{ desiredRetention: ${settings.retention} }}`,
    `${indent}>`,
    `${indent}  <StudyView session={{ limit: ${settings.limit}, order: '${settings.order}' }} />`,
    `${indent}  <ProgressDashboard forecastDays={14} />`,
    `${indent}</SRSProvider>`,
  ].join('\n');

  const body = localised
    ? [
        `    <RecallIntl locale="${settings.locale}" strings={strings}>`,
        provider,
        `    </RecallIntl>`,
      ].join('\n')
    : provider;

  return `${imports}

// Built once, outside the component: a new adapter each render would
// reset the provider's card cache on every keystroke.
const adapter = createLocalStorageAdapter({ namespace: '${namespace}' });

export function Study() {
  return (
${body}
  );
}
`;
}
