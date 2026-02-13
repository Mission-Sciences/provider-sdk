/**
 * Vitest Configuration
 *
 * Main configuration for running tests.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment - use node for better compatibility
    environment: 'node',

    // Test timeout
    testTimeout: 10000,

    // Include all test files
    include: ['tests/**/*.test.ts'],

    // Exclude integration tests that require live API, but allow utils unit tests
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/integration/jwt/**',
      'tests/integration/sessions/**',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types.ts'],
    },

    // Pool options - use forks for better isolation
    pool: 'forks',

    // Globals
    globals: false,
  },
});
