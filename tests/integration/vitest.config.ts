/**
 * Vitest Configuration for Integration Tests
 *
 * Separate configuration for integration tests that interact with real API.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Global setup and teardown
    globalSetup: path.resolve(__dirname, './setup.ts'),

    // Test timeout (integration tests may take longer)
    testTimeout: 30000,

    // Hook timeout
    hookTimeout: 10000,

    // Include integration tests
    include: ['**/*.test.ts'],

    // Exclude unit tests
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/utils/**/*.test.ts', // Exclude utility unit tests
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types.ts'],
    },

    // Reporter
    reporters: ['verbose'],

    // Retry failed tests
    retry: 0, // Don't retry integration tests by default

    // Pool options - use forks for better isolation and AbortController compatibility
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@tests': path.resolve(__dirname, '../'),
    },
  },
});
