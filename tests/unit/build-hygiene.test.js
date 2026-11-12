import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Regression: vite.config.js listed 'simple-peer' in manualChunks although no source file imports it, which bundled the
// package (and readable-stream) into the app and produced "module externalized" build warnings.
const root = path.resolve(__dirname, '../..');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const sources = walk(path.join(root, 'src')).filter((f) => /\.(js|jsx)$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const config = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
const chunkPackages = [...(config.match(/manualChunks:\s*\{([\s\S]*?)\n\s*\}/)?.[1].matchAll(/'([^']+)'(?=[,\]\s])/g) ?? [])].map((m) => m[1]).filter((n) => !n.startsWith('vendor-'));

describe('vite manualChunks', () => {
  it('found the configured packages', () => expect(chunkPackages.length).toBeGreaterThan(0));
  it.each(chunkPackages)('"%s" is actually imported by the app', (pkg) => {
    const imported = new RegExp(`from\\s+['"]${pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/[^'"]*)?['"]`).test(sources);
    expect(imported, `${pkg} is in manualChunks but never imported`).toBe(true);
  });
});

// Regression: the dev server watched test-artifacts/, so every trace/screenshot/report written during an E2E run
// triggered a full page reload in the browser under test (order-dependent, intermittent failures).
describe('vite dev server file watching', () => {
  it.each(['test-artifacts', 'playwright-report', 'test-results', 'coverage'])('ignores %s', (dir) => {
    const ignored = config.match(/watch:\s*\{[\s\S]*?ignored:\s*\[([\s\S]*?)\]/)?.[1] ?? '';
    expect(ignored, `${dir} is not in server.watch.ignored`).toContain(dir);
  });
});
