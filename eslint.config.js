import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'myCam-release-candidate', 'mycloud_v0.4', 'server', 'test-artifacts', 'playwright-report', 'test-results', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]|motion' }],
    },
  },
  {
    // Test and tooling files run in Node (and some in jsdom/Chromium): they need Node globals such as `process` and `Buffer`.
    // No rules are relaxed here.
    files: ['tests/**/*.{js,jsx}', 'playwright.config.js', 'vitest.config.js', 'vitest.real.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
])
