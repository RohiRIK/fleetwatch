import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load test environment variables
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['__tests__/setup.ts'],
      env: {
        ...env,
        // Override with test-specific env vars
        DATABASE_URL: env.DATABASE_URL || 'postgresql://test:test@localhost:5432/fleetwatch_test',
        REDIS_URL: env.REDIS_URL || 'redis://localhost:6379/1',
        NEXTAUTH_SECRET: env.NEXTAUTH_SECRET || 'test-secret',
        NEXTAUTH_URL: env.NEXTAUTH_URL || 'http://localhost:3000',
        ADMIN_EMAIL: env.ADMIN_EMAIL || 'admin@device-inventory.local',
        NODE_ENV: 'test',
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
        exclude: [
          'node_modules/',
          '__tests__/',
          '*.config.ts',
          '*.config.js',
          'drizzle/',
          '.next/',
          'dist/',
        ],
        include: [
          'lib/**/*.{ts,tsx}',
          'app/**/*.{ts,tsx}',
          'components/**/*.{ts,tsx}',
        ],
        thresholds: {
          lines: 50,
          functions: 50,
          branches: 50,
          statements: 50,
        },
      },
      include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['node_modules', '.next', 'dist', '__tests__/e2e/**'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
  };
});
