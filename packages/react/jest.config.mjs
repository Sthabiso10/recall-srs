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
          jsx: 'react-jsx',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@recall-srs/core$': '<rootDir>/../core/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json'],
};
