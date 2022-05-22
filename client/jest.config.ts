/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'node',
  testMatch: ['**/test/**', '!**/src/**'],
  testPathIgnorePatterns: ['dist'],
  transform: {'^.+\\.ts?$': 'ts-jest'},
  transformIgnorePatterns: ['node_modules/(?!@serverless-trading-system-utility-layer)/']
};