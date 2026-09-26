// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * Flat config. ESLint 9 dropped `.eslintrc` support by default and 10 removed
 * it, so the rule set that used to live in `.eslintrc.json` is expressed here
 * as an ordered array — later entries win.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '.wrangler/**',
      '**/node_modules/**',
      '**/*.config.*',
      'packages/adapters/convex/src/convex/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Plain .mjs scripts: build helpers, the demo recorder, the example. They
  // run in Node and, in the recorder's case, evaluate code inside a page.
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },

  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },

  // Prettier last: it only turns off rules that would fight the formatter.
  prettier,
);
