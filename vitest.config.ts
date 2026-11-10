import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Unit tests start from `.env.example`, as CI does: a developer's `.env` with services or optional
 * features switched on must not change their outcome. A test that needs one stubs it itself.
 */
const UNSET_ENVIRONMENT = Object.fromEntries([
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_API_BASE_URL', 'VITE_GENERATOR_HISTORY',
  'VITE_REPORT_STORAGE', 'VITE_STRUCTURE_PREDICTION', 'VITE_PROJECT_CREATE_IDEMPOTENCY', 'VITE_PROJECT_LIVE',
].map((name) => [name, '']));

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    env: UNSET_ENVIRONMENT,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/main.tsx',
        'src/test/**',
        'src/gen/**',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
      ],
    },
  },
});
