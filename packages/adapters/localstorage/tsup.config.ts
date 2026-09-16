import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
  // The backend SDK is always a peer dependency — never bundle a second copy
  // of the client the host app already configured and authenticated.
  external: ['@recall-srs/core', '@supabase/supabase-js', 'firebase', 'firebase/firestore'],
});
