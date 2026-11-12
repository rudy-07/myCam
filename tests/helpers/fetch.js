import { vi } from 'vitest';

/** JSON Response with the content-type the real backend sends. */
export const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

export const textResponse = (text, status = 200, type = 'text/html') =>
  new Response(text, { status, headers: { 'content-type': type } });

/**
 * Replace global fetch with a handler. The handler receives { url, method, headers, body, signal }
 * and returns a Response (or undefined = "unexpected request", which fails the test loudly).
 * Returns the vi.fn so tests can inspect `.calls`.
 */
export function installFetch(handler) {
  const calls = [];
  const fn = vi.fn(async (url, opts = {}) => {
    const call = {
      url: String(url),
      method: String(opts.method || 'GET').toUpperCase(),
      headers: opts.headers || {},
      body: opts.body,
      signal: opts.signal,
    };
    calls.push(call);
    const res = await handler(call);
    if (!res) throw new Error(`Unhandled fetch in test: ${call.method} ${call.url}`);
    return res;
  });
  fn.calls = calls;
  vi.stubGlobal('fetch', fn);
  return fn;
}

export const parseBody = (call) => (call.body ? JSON.parse(call.body) : undefined);
export const signIn = (user = { id: 7, username: 'tester', name: 'Test User', email: 'tester@example.com' }, token = 'tok.en.value') => {
  localStorage.setItem('mycam_token', token);
  localStorage.setItem('mycam_user', JSON.stringify(user));
  return user;
};
