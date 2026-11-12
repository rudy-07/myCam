import { defineConfig } from 'vitest/config';

// Integration tests against the REAL backend and a real database.
// They need: backend on http://127.0.0.1:3000 and its database. See TEST_PLAN.md.
// Run with: npm run test:real
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/real/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
