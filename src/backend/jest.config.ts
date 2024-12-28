// jest.config.ts
// Jest configuration for backend services v29.0.0
// Configures test environment, coverage settings, and TypeScript compilation

import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Define root directory for tests
  rootDir: '.',

  // Specify file extensions to be handled
  moduleFileExtensions: [
    'js',
    'json',
    'ts'
  ],

  // Configure test file pattern matching
  testRegex: '.*\\.test\\.ts$',

  // TypeScript transformation configuration
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/__tests__/**',
    '!**/__mocks__/**'
  ],

  // Coverage output directory
  coverageDirectory: './coverage',

  // Paths to ignore during testing
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Module path aliases matching tsconfig.json
  moduleNameMapper: {
    '@shared/(.*)': '<rootDir>/shared/$1',
    '@proto/(.*)': '<rootDir>/shared/proto/$1',
    '@models/(.*)': '<rootDir>/shared/models/$1',
    '@utils/(.*)': '<rootDir>/shared/utils/$1',
    '@email/(.*)': '<rootDir>/email-service/$1',
    '@context/(.*)': '<rootDir>/context-engine/$1',
    '@response/(.*)': '<rootDir>/response-generator/$1',
    '@auth/(.*)': '<rootDir>/auth-service/$1'
  },

  // Coverage thresholds to enforce
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Enable verbose test output
  verbose: true,

  // Set test timeout (30 seconds)
  testTimeout: 30000,

  // Limit test workers to 50% of available CPU cores for optimal performance
  maxWorkers: '50%',

  // Global setup and teardown configurations
  globalSetup: '<rootDir>/test/setup.ts',
  globalTeardown: '<rootDir>/test/teardown.ts',

  // Configure test result reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './reports/junit',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ],

  // Configure test result caching for faster reruns
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache'
};

export default config;