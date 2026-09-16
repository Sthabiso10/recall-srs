/**
 * Fails the build if the `use client` directive is missing from the bundles.
 *
 * This regressed silently once already: tsup's `banner` option looked correct
 * in the config but the directive never reached the output, and nothing caught
 * it because the package still imported fine outside Next.js. A publish in that
 * state breaks every App Router consumer. So the build proves it now.
 */
import { readFile } from 'node:fs/promises';

const FILES = ['dist/index.js', 'dist/index.cjs'];
const failures = [];

for (const file of FILES) {
  const head = (await readFile(file, 'utf8')).slice(0, 40);
  if (!/^(['"])use client\1/.test(head.trimStart())) failures.push(file);
}

if (failures.length > 0) {
  console.error(
    `\n  ✗ Missing "use client" directive in:\n${failures.map((f) => `      ${f}`).join('\n')}\n` +
      `\n    @recall-srs/react is a client-only package. Without this directive\n` +
      `    it cannot be imported in a Next.js App Router tree.\n` +
      `    Fix: see onSuccess() in packages/react/tsup.config.ts\n`,
  );
  process.exit(1);
}

console.log('  ✓ "use client" present in both bundles');
