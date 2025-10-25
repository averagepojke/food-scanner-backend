// Jest configuration for Food Scanner App Security Testing
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    '<rootDir>/jest.setup.js'
  ],
  testMatch: [
    '**/__tests__/**/*.js?(x)',
    '**/?(*.)+(spec|test).js?(x)'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.expo/',
    '<rootDir>/food-scanner-backend/'
  ],
  collectCoverageFrom: [
    '**/*.{js,jsx}',
    '!**/*.config.js',
    '!**/node_modules/**',
    '!**/.expo/**',
    '!**/coverage/**',
    '!**/jest.setup.js',
    '!**/food-scanner-backend/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@expo|expo|@unimodules|@react-navigation)/)'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Security-focused test configuration
  testTimeout: 30000, // 30 second timeout for security tests
  verbose: true,
  // Mock external dependencies for security isolation
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  globals: {
    __DEV__: true,
  }
};