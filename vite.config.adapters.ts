import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: {
        'adapters/react/index': resolve(__dirname, 'src/adapters/react/index.ts'),
        'adapters/vue/index': resolve(__dirname, 'src/adapters/vue/index.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: ['react', 'vue', /^\.\.\/\.\.\//, '@mission_sciences/provider-sdk'],
    },
    sourcemap: true,
    target: 'es2020',
  },
  plugins: [
    dts({ outDir: 'dist' }),
  ],
});
