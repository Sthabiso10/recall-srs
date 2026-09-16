import { defineConfig } from 'tsup';

// Dual ESM + CJS output with .d.ts, so the engine works in Next.js server
// components, Vite apps, React Native and plain Node scripts alike.
export default defineConfig({
  // Two entry points. The optimiser is a batch job — keeping it on its own
  // subpath means a study app never ships the fitting code to a browser.
  entry: ['src/index.ts', 'src/optimizer/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
});
