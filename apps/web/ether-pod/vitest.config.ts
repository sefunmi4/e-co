import { defineConfig, configDefaults } from 'vitest/config';
import path from 'node:path';

const loadReactPlugin = async () =>
  import('@vitejs/plugin-react')
    .then((mod) => mod.default)
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unknown error loading plugin';
      console.warn(
        `[@eco/web] Unable to load @vitejs/plugin-react (fallback to esbuild JSX transform): ${message}`,
      );
      return null;
    });

export default defineConfig(async () => {
  const react = await loadReactPlugin();

  const plugins = react ? [react()] : [];

  return {
    plugins,
    esbuild: react
      ? undefined
      : {
          jsx: 'automatic',
          jsxImportSource: 'react',
        },
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
  };
});
