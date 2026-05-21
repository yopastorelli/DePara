module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/logs/',
    '/dist/',
    '/build/',
    '/tests/e2e/'
  ],
  testTimeout: 10000,
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/public/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  transform: {},
  moduleFileExtensions: ['js', 'json'],
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  }
};
