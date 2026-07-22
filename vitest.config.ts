/**
 * Vitest Configuration
 *
 * Main configuration for running tests.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom is required for React hooks tests (useGWBalance, useGWItems,
    // useGWPurchase). Pure-TS unit tests are also compatible with jsdom.
    environment: 'jsdom',

    // Enable globals so @testing-library/react helpers are auto-imported.
    globals: true,

    // Test timeout
    testTimeout: 10000,

    // Include all test files
    include: ['tests/**/*.test.ts'],

    // Exclude integration tests by default (they require live API)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/integration/**',
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
  },
});
