import { describe, it, expect, vi } from 'vitest';
import {
  postAuthJson, passwordChecks, generateStrongPassword, PASSWORD_RULES, PASSWORD_MAX_LENGTH, validatePasswordPolicy, validateRegistration,
} from '../../src/lib/authRequest';
import { installFetch, jsonResponse, textResponse, parseBody } from '../helpers/fetch';

describe('postAuthJson', () => {
  it('POSTs JSON and returns the parsed body', async () => {
    const f = installFetch(() => jsonResponse({ token: 't', user: { id: 1 } }));
    expect(await postAuthJson('/api/login', { a: 1 })).toEqual({ token: 't', user: { id: 1 } });
    expect(f.calls[0].method).toBe('POST');
    expect(f.calls[0].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(parseBody(f.calls[0])).toEqual({ a: 1 });
  });
  it('returns {} for an empty successful body', async () => {
    installFetch(() => new Response('', { status: 200 }));
    expect(await postAuthJson('/x', {})).toEqual({});
  });
  it('never surfaces an HTML page, even on success (SPA fallback)', async () => {
    installFetch(() => textResponse('<!doctype html><html>app</html>', 200));
    expect(await postAuthJson('/x', {})).toEqual({});
  });
  it.each([
    ['server JSON message', () => jsonResponse({ message: 'Invalid credentials' }, 401), 'Invalid credentials'],
    ['HTML error page', () => textResponse('<html>Bad Gateway</html>', 502), 'Request failed (502). Please try again.'],
    ['empty error body', () => new Response('', { status: 500 }), 'Request failed (500). Please try again.'],
    ['invalid JSON body', () => new Response('{"x":', { status: 500, headers: { 'content-type': 'application/json' } }), 'Request failed (500). Please try again.'],
    ['blank JSON message', () => jsonResponse({ message: '   ' }, 400), 'Request failed (400). Please try again.'],
    ['non-string JSON message', () => jsonResponse({ message: { a: 1 } }, 400), 'Request failed (400). Please try again.'],
    ['plain-text message', () => textResponse('Too many requests', 429, 'text/plain'), 'Too many requests'],
  ])('error: %s', async (_l, make, message) => {
    installFetch(make);
    await expect(postAuthJson('/x', {})).rejects.toThrow(message);
  });
  it('truncates very long plain-text errors to 240 characters', async () => {
    installFetch(() => textResponse('x'.repeat(1000), 500, 'text/plain'));
    await expect(postAuthJson('/x', {})).rejects.toThrow(new RegExp(`^x{240}$`));
  });
  it('maps a network failure to a friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(postAuthJson('/x', {})).rejects.toThrow(/could not reach mycam/i);
  });
});

describe('password rules', () => {
  it('has five rules with ids', () => expect(PASSWORD_RULES.map((r) => r.id)).toEqual(['length', 'upper', 'lower', 'number', 'special']));
  it('reports which rules pass', () => {
    const passed = Object.fromEntries(passwordChecks('abcdefgh').map((c) => [c.id, c.passed]));
    expect(passed).toEqual({ length: true, upper: false, lower: true, number: false, special: false });
  });
  it('a spaces-only special character still counts as special (matches the backend regex)', () => expect(passwordChecks('Abcdefg1 ').find((c) => c.id === 'special').passed).toBe(true));
});

describe('validatePasswordPolicy (mirrors server/auth.cjs)', () => {
  it.each([
    ['Str0ng!Pass', ''], ['Aa1!aaaa', ''], [`Aa1!${'x'.repeat(PASSWORD_MAX_LENGTH - 4)}`, ''],
    ['Aa1!aaa', /8 characters/], [`Aa1!${'x'.repeat(PASSWORD_MAX_LENGTH - 3)}`, /128/], ['aa1!aaaa', /uppercase/], ['AA1!AAAA', /lowercase/],
    ['Aaa!aaaa', /number/], ['Aaa1aaaa', /special/], ['', /8 characters/], [undefined, /8 characters/], [null, /8 characters/], [12345678, /8 characters/],
  ])('%j', (pw, expected) => {
    const r = validatePasswordPolicy(pw);
    if (expected === '') expect(r).toBe(''); else expect(r).toMatch(expected);
  });
});

describe('validateRegistration (mirrors server/auth.cjs)', () => {
  const ok = { name: 'Rudy', username: 'rudy.cam', email: 'rudy@example.com', password: 'Str0ng!Pass' };
  it('accepts valid input', () => expect(validateRegistration(ok)).toBe(''));
  it.each([
    [{ name: '' }, /name/i], [{ name: '   ' }, /name/i], [{ name: 'n'.repeat(101) }, /100/], [{ name: undefined }, /name/i],
    [{ username: 'ab' }, /username/i], [{ username: 'a'.repeat(41) }, /username/i], [{ username: 'has space' }, /username/i], [{ username: 'bad@x' }, /username/i], [{ username: 'ünï' }, /username/i],
    [{ email: 'nope' }, /email/i], [{ email: 'a@b' }, /email/i], [{ email: 'a b@c.d' }, /email/i], [{ email: `${'a'.repeat(250)}@b.co` }, /email/i],
    [{ password: 'weak' }, /8 characters/],
  ])('rejects %j', (override, msg) => expect(validateRegistration({ ...ok, ...override })).toMatch(msg));
  it.each([['abc'], ['a_b'], ['a.b-c'], ['A1_'], ['a'.repeat(40)]])('accepts username %s', (u) => expect(validateRegistration({ ...ok, username: u })).toBe(''));
});

describe('generateStrongPassword', () => {
  it('always satisfies the backend policy and requested length', () => {
    for (let i = 0; i < 300; i += 1) {
      const pw = generateStrongPassword(16);
      expect(pw).toHaveLength(16);
      expect(validatePasswordPolicy(pw)).toBe('');
    }
  });
  it('enforces a minimum length of 8', () => expect(generateStrongPassword(2)).toHaveLength(8));
  it('uses crypto.getRandomValues and never Math.random', () => {
    const rand = vi.spyOn(Math, 'random'); const crypt = vi.spyOn(globalThis.crypto, 'getRandomValues');
    generateStrongPassword();
    expect(crypt).toHaveBeenCalled();
    expect(rand).not.toHaveBeenCalled();
  });
  it('is not constant', () => expect(new Set(Array.from({ length: 20 }, () => generateStrongPassword())).size).toBe(20));
});
