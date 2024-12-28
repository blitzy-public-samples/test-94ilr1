import type { Config } from '@jest/types';

// Jest configuration for the web frontend application
const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  
  // Use jsdom for browser environment simulation
  testEnvironment: 'jsdom',
  
  // Define root directories for tests and source files
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],
  
  // Module path aliases mapping for clean imports
  moduleNameMapper: {
    // Source directory aliases
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@assets/(.*)$': '<rootDir>/src/assets/$1',
    '^@styles/(.*)$': '<rootDir>/src/styles/$1',
    
    // Asset mocks
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/__mocks__/fileMock.js'
  },
  
  // Setup files to run after Jest is initialized
  setupFilesAfterEnv: [
    '<rootDir>/tests/setupTests.ts'
  ],
  
  // Test file patterns to match
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx'
  ],
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/vite-env.d.ts',
    '!src/main.tsx',
    '!src/App.tsx'
  ],
  
  // Coverage thresholds to enforce
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Transform configuration for TypeScript files
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  
  // File extensions to consider for module resolution
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],
  
  // Global configuration for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  },
  
  // Test timeout in milliseconds
  testTimeout: 10000,
  
  // Enable verbose test output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocked state between tests
  restoreMocks: true
};

export default config;