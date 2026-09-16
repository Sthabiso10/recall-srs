import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
  // Never bundle React or the engine: consumers must get a single React
  // instance, and @recall-srs/core stays independently updatable.
  external: ['react', 'react-dom', '@recall-srs/core'],

  /**
   * Re-add the `use client` directive to the built bundles.
   *
   * Every export in this package is stateful and interactive, so the whole
   * bundle is a client module. Without the directive, importing
   * `@recall-srs/react` anywhere in a Next.js App Router tree fails — and that
   * is most of the audience, so it has to be right.
   *
   * tsup's `banner` option does NOT survive here. The bundler treats module
   * level directives as unsafe to hoist and drops them ("Module level
   * directives cause errors when bundled"), leaving the output with no
   * directive at all. Prepending after the files are written is the only
   * approach that reliably survives, and `verify-use-client` in the build
   * script checks the result rather than trusting the config.
   */
  async onSuccess() {
    const { readFile, writeFile } = await import('node:fs/promises');
    const DIRECTIVE = `'use client';`;

    for (const file of ['dist/index.js', 'dist/index.cjs']) {
      const contents = await readFile(file, 'utf8');
      if (contents.startsWith(DIRECTIVE) || contents.startsWith('"use client"')) continue;
      await writeFile(file, `${DIRECTIVE}\n${contents}`, 'utf8');
    }
  },
});
