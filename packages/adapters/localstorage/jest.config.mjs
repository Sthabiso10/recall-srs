/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  transform: {
    '^.+\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          verbatimModuleSyntax: false,
          module: 'CommonJS',
          isolatedModules: false,
        },
      },
    ],
  },
  moduleNameMapper: {
    // Resolve the workspace dependency to source; no build step before tests.
    '^@recall-srs/core$': '<rootDir>/../../core/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json'],
};
