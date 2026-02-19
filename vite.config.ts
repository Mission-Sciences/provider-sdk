/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MarketplaceSDK',
      formats: ['es', 'umd'],
      fileName: (format) => `marketplace-sdk.${format}.js`,
    },
    rollupOptions: {
      // jose is browser-compatible, bundle it
      // react and vue are optional peer deps - never bundle them
      external: ['react', 'vue'],
      output: {
        globals: {
          react: 'React',
          vue: 'Vue',
        },
      },
    },
    sourcemap: true,
    // Target modern browsers
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'examples/',
        'dist/',
        'scripts/',
      ],
    },
  },
});
