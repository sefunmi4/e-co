import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@eco/js-sdk': path.resolve(__dirname, '../../..', 'sdks/js/src'),
      '@eco/js-sdk/commands': path.resolve(
        __dirname,
        '../../..',
        'sdks/js/src/commands.ts'
      ),
      '@eco/js-sdk/ai': path.resolve(
        __dirname,
        '../../..',
        'sdks/js/src/ai.ts'
      ),
      '@eco/js-sdk/state': path.resolve(
        __dirname,
        '../../..',
        'sdks/js/src/state.ts'
      ),
      '@eco/js-sdk/gestures': path.resolve(
        __dirname,
        '../../..',
        'sdks/js/src/gestures.ts'
      ),
      '@eco/js-sdk/logger': path.resolve(
        __dirname,
        '../../..',
        'sdks/js/src/logger.ts'
      ),
      '@frontend': path.resolve(__dirname, 'frontend'),
      '@backend': path.resolve(__dirname, 'backend'),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'ethos/**', 'frontend/tests/**'],
    setupFiles: ['./test/vitest.setup.ts'],
  },
});
