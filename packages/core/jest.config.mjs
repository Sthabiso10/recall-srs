/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  transform: {
    // ts-jest compiles TS -> CJS for the test run only. tsup still produces the
    // real ESM + CJS build, so this never touches published output.
    '^.+\\.tsx?$': [
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
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts'],
};
