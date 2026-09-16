import { defineConfig } from 'tsup';

// Dual ESM + CJS output with .d.ts, so the engine works in Next.js server
// components, Vite apps, React Native and plain Node scripts alike.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
});
