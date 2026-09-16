import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
  // `src/convex/*` is shipped as source, not bundled — those files are copied
  // into the consumer's own convex/ directory and compiled by Convex itself.
  external: ['@recall-srs/core', 'convex', 'convex/server', 'convex/values'],
});
