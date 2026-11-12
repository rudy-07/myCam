import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Only these are tolerated automatically: Google Fonts (index.html loads them from the internet; unreachable in an offline
// test machine) and Socket.IO polling requests (no signalling server in mocked mode). Everything else fails the test.
const TOLERATED_URL = /fonts\.(googleapis|gstatic)\.com|\/socket\.io\//;

export const test = base.extend({
  /** Tests that deliberately trigger a failure push a RegExp here for the browser/app messages they expect. */
  allowConsole: async ({ page }, provide) => { void page; await provide([]); }, // a fresh list per test (depends on page so it is created per test)
  consoleErrors: [async ({ page, allowConsole }, provide, testInfo) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const url = m.location()?.url || '';
      if (TOLERATED_URL.test(url) || TOLERATED_URL.test(m.text())) return;
      if (allowConsole.some((re) => re.test(m.text()))) return;
      errors.push(`${m.text()} (${url})`);
    });
    page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
    await provide(errors);
    await testInfo.attach('console-errors.txt', { body: errors.join('\n') || '(none)', contentType: 'text/plain' });
    expect(errors, 'unexpected browser console errors').toEqual([]);
  }, { auto: true }],
});

export async function shot(page, testInfo, name) {
  const dir = path.join('test-artifacts', 'screenshots', testInfo.project.name);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}
export { expect };
