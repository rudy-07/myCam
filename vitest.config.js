import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit, component and mocked-contract integration tests. No backend is required.
// Tests that need the real backend live in tests/real and use vitest.real.config.js.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.{js,jsx}', 'tests/components/**/*.test.{js,jsx}', 'tests/integration/**/*.test.{js,jsx}'],
    css: false,
    restoreMocks: true,
    unstubGlobals: true,
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/**/*.css'],
      reporter: ['text', 'text-summary', 'html', 'json-summary'],
      reportsDirectory: 'test-artifacts/coverage',
    },
  },
});
