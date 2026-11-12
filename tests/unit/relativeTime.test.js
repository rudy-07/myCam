import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../../src/lib/relativeTime';

const NOW = Date.parse('2026-11-05T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

describe('formatRelativeTime', () => {
  it.each([
    [0, 'just now'], [59_000, 'just now'], [60_000, '1m ago'], [59 * 60_000, '59m ago'],
    [60 * 60_000, '1h ago'], [23 * 3_600_000 + 59 * 60_000, '23h ago'],
  ])('%i ms ago -> %s', (ms, label) => expect(formatRelativeTime(ago(ms), NOW)).toBe(label));
  it('shows a short date from 24 hours on', () => expect(formatRelativeTime(ago(24 * 3_600_000), NOW)).toMatch(/\d/));
  it('treats a slightly-future timestamp (clock skew) as just now', () => expect(formatRelativeTime(new Date(NOW + 30_000).toISOString(), NOW)).toBe('just now'));
  it.each([['garbage'], [''], [undefined], [null]])('returns an empty string for %j', (v) => expect(formatRelativeTime(v === null ? 'x' : v, NOW)).toBe(''));
});
